import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawnSync } from 'child_process';

const isWin = process.platform === 'win32';
const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const toolingDir = path.join(rootDir, '.gradle-tooling');
const gradleVersion = '8.14.3';
const gradleDistUrl = `https://services.gradle.org/distributions/gradle-${gradleVersion}-bin.zip`;

/**
 * Parse Java major version and full output from version text or release file.
 */
export function parseJavaVersion(versionOutput) {
  if (!versionOutput || typeof versionOutput !== 'string') {
    return { major: null, raw: '' };
  }

  const raw = versionOutput.trim();

  // 1. Quoted version style: openjdk version "17.0.14" or "25-ea" or "1.8.0_392"
  const quotedMatch = raw.match(/version\s+"(?:1\.)?([0-9]+)(?:\.([0-9]+))?.*?"/i);
  if (quotedMatch) {
    return { major: parseInt(quotedMatch[1], 10), raw };
  }

  // 2. Release file style: JAVA_VERSION="17.0.14" or JAVA_VERSION="25"
  const releaseMatch = raw.match(/JAVA_VERSION="?(?:1\.)?([0-9]+)(?:\.([0-9]+))?.*?"?/i);
  if (releaseMatch) {
    return { major: parseInt(releaseMatch[1], 10), raw };
  }

  // 3. Fallback pattern: openjdk 17 or java 17
  const genericMatch = raw.match(/(?:openjdk|java|jdk)\s+(?:version\s+)?(?:1\.)?([0-9]+)/i);
  if (genericMatch) {
    return { major: parseInt(genericMatch[1], 10), raw };
  }

  // 4. Standalone version like 17.0.14
  const standaloneMatch = raw.match(/\b17\.[0-9]+(?:\.[0-9]+)?/);
  if (standaloneMatch) {
    return { major: 17, raw };
  }

  return { major: null, raw };
}

/**
 * Inspect a directory or executable to determine if it is a valid Java runtime and detect its version.
 */
export function inspectJavaLocation(candidatePath, sourceLabel = '') {
  if (!candidatePath || typeof candidatePath !== 'string') return null;

  try {
    const trimmedPath = candidatePath.trim().replace(/^"|"$/g, '');
    if (!fs.existsSync(trimmedPath)) return null;

    const stats = fs.statSync(trimmedPath);
    let resolvedHome = null;
    let javaBin = null;
    const binName = isWin ? 'java.exe' : 'java';

    if (stats.isDirectory()) {
      // Direct JDK home check: <candidatePath>/bin/java.exe
      const directBin = path.join(trimmedPath, 'bin', binName);
      // macOS bundle check: <candidatePath>/Contents/Home/bin/java
      const macHomeBin = path.join(trimmedPath, 'Contents', 'Home', 'bin', 'java');
      // Sub-bin check if candidatePath is already the bin directory
      const inBin = path.join(trimmedPath, binName);

      if (fs.existsSync(directBin) && fs.statSync(directBin).isFile()) {
        javaBin = directBin;
        resolvedHome = trimmedPath;
      } else if (process.platform === 'darwin' && fs.existsSync(macHomeBin) && fs.statSync(macHomeBin).isFile()) {
        javaBin = macHomeBin;
        resolvedHome = path.join(trimmedPath, 'Contents', 'Home');
      } else if (path.basename(trimmedPath).toLowerCase() === 'bin' && fs.existsSync(inBin) && fs.statSync(inBin).isFile()) {
        javaBin = inBin;
        resolvedHome = path.dirname(trimmedPath);
      }
    } else if (stats.isFile()) {
      // Must actually be a java executable file
      const fileName = path.basename(trimmedPath).toLowerCase();
      if (fileName === (isWin ? 'java.exe' : 'java')) {
        javaBin = trimmedPath;
        const parentDir = path.dirname(trimmedPath);
        if (path.basename(parentDir).toLowerCase() === 'bin') {
          resolvedHome = path.dirname(parentDir);
        } else {
          resolvedHome = parentDir;
        }
      }
    }

    if (!javaBin || !resolvedHome || !fs.existsSync(javaBin)) {
      return null;
    }

    // Now test the java executable by running `java -version`
    let versionOutput = '';
    try {
      const res = spawnSync(javaBin, ['-version'], {
        encoding: 'utf8',
        shell: false,
        windowsVerbatimArguments: true,
        timeout: 4000
      });
      versionOutput = (res.stderr || res.stdout || '').trim();
    } catch {}

    // Also check release file if present
    let versionInfo = null;
    const releaseFile = path.join(resolvedHome, 'release');
    if (fs.existsSync(releaseFile)) {
      try {
        const releaseContent = fs.readFileSync(releaseFile, 'utf8');
        const relInfo = parseJavaVersion(releaseContent);
        if (relInfo.major !== null) {
          versionInfo = relInfo;
        }
      } catch {}
    }

    if (versionOutput) {
      const execVersionInfo = parseJavaVersion(versionOutput);
      if (execVersionInfo.major !== null) {
        versionInfo = execVersionInfo;
      }
    }

    // If neither execution nor release file returned a valid major version number, this is NOT a valid Java runtime
    if (!versionInfo || versionInfo.major === null || isNaN(versionInfo.major)) {
      return null;
    }

    const major = versionInfo.major;
    const firstLine = versionOutput
      ? versionOutput.split(/\r?\n/)[0].trim()
      : `Java ${major}`;
    const isJava17 = major === 17;

    return {
      javaHome: resolvedHome,
      javaBin,
      majorVersion: major,
      versionString: firstLine,
      source: sourceLabel || path.basename(resolvedHome),
      isJava17
    };
  } catch {
    return null;
  }
}

/**
 * Perform exhaustive, prioritized Java runtime detection.
 * 
 * Strict Priority:
 * 1. Existing JAVA_HOME if it points to a compatible Java 17 installation.
 * 2. Common Windows / macOS / Linux JDK 17 locations (Adoptium, Oracle, Microsoft, Corretto, BellSoft, Zulu, RedHat, Scoop, Chocolatey, etc.).
 * 3. Android Studio JBR only if its Java version is Java 17.
 * 4. System PATH 'java' if it is Java 17.
 * 
 * If only Java 25 (or other incompatible versions) is found, returns compatible: false with diagnostic details.
 */
export function detectJavaRuntime() {
  const incompatibleList = [];
  const scannedPaths = new Set();

  function evaluateCandidate(candidatePath, label) {
    if (!candidatePath || typeof candidatePath !== 'string') return null;
    const normalized = path.normalize(candidatePath);
    if (scannedPaths.has(normalized)) return null;
    scannedPaths.add(normalized);

    const info = inspectJavaLocation(candidatePath, label);
    if (!info) return null;

    if (info.isJava17) {
      return info;
    } else {
      incompatibleList.push(info);
      return null;
    }
  }

  // Priority 1: Check process.env.JAVA_HOME
  if (process.env.JAVA_HOME) {
    const javaHomeResult = evaluateCandidate(process.env.JAVA_HOME, 'JAVA_HOME Environment Variable');
    if (javaHomeResult) {
      return {
        compatible: true,
        javaHome: javaHomeResult.javaHome,
        majorVersion: javaHomeResult.majorVersion,
        versionString: javaHomeResult.versionString,
        source: 'JAVA_HOME',
        incompatibleFound: null
      };
    }
  }

  // Priority 2: Probe standard JDK 17 vendor directories across platforms
  const potentialJdkLocations = [];

  if (isWin) {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';
    const userProfile = process.env.USERPROFILE || '';
    const systemDrive = process.env.SystemDrive || 'C:';

    // Search vendor root directories for version 17 folders
    const vendorParents = [
      path.join(programFiles, 'Eclipse Adoptium'),
      path.join(programFiles, 'Java'),
      path.join(programFiles, 'Microsoft'),
      path.join(programFiles, 'Amazon Corretto'),
      path.join(programFiles, 'BellSoft'),
      path.join(programFiles, 'Zulu'),
      path.join(programFiles, 'Azul Systems', 'Zulu'),
      path.join(programFiles, 'Semeru'),
      path.join(programFiles, 'RedHat'),
      path.join(programFilesX86, 'Eclipse Adoptium'),
      path.join(programFilesX86, 'Java'),
      path.join(programFilesX86, 'Microsoft'),
      path.join(programFilesX86, 'Amazon Corretto'),
      path.join(programFilesX86, 'BellSoft'),
      path.join(localAppData, 'Programs', 'Eclipse Adoptium'),
      path.join(localAppData, 'Programs', 'Java'),
      path.join(localAppData, 'Programs', 'Microsoft'),
      path.join(userProfile, '.jdks'),
      path.join(systemDrive, 'Java'),
      path.join(systemDrive, 'JDK')
    ];

    for (const parent of vendorParents) {
      if (fs.existsSync(parent)) {
        try {
          const stats = fs.statSync(parent);
          if (stats.isDirectory()) {
            potentialJdkLocations.push({ path: parent, label: `Installed JDK (${path.basename(parent)})` });
            const entries = fs.readdirSync(parent);
            for (const entry of entries) {
              const fullPath = path.join(parent, entry);
              try {
                if (fs.statSync(fullPath).isDirectory()) {
                  potentialJdkLocations.push({ path: fullPath, label: `Installed JDK (${entry})` });
                }
              } catch {}
            }
          }
        } catch {}
      }
    }

    // Specific known Scoop / Chocolatey paths
    const specificPaths = [
      path.join(userProfile, 'scoop', 'apps', 'openjdk17', 'current'),
      path.join(userProfile, 'scoop', 'apps', 'temurin17-jdk', 'current'),
      path.join(userProfile, 'scoop', 'apps', 'oraclejdk17', 'current'),
      path.join(userProfile, 'scoop', 'apps', 'microsoft-jdk17', 'current'),
      path.join(userProfile, 'scoop', 'apps', 'corretto17', 'current'),
      path.join(userProfile, 'scoop', 'apps', 'zulu17', 'current'),
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'lib', 'openjdk17'),
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'lib', 'temurin17'),
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'lib', 'microsoft-openjdk17')
    ];

    for (const sp of specificPaths) {
      potentialJdkLocations.push({ path: sp, label: `Package Manager JDK (${path.basename(sp)})` });
    }
  } else if (process.platform === 'darwin') {
    // macOS Java Virtual Machines
    const jvmDirs = ['/Library/Java/JavaVirtualMachines', path.join(process.env.HOME || '', 'Library', 'Java', 'JavaVirtualMachines')];
    for (const jvmDir of jvmDirs) {
      if (fs.existsSync(jvmDir)) {
        try {
          const entries = fs.readdirSync(jvmDir);
          for (const entry of entries) {
            potentialJdkLocations.push({
              path: path.join(jvmDir, entry, 'Contents', 'Home'),
              label: `macOS JVM (${entry})`
            });
          }
        } catch {}
      }
    }
    potentialJdkLocations.push(
      { path: '/opt/homebrew/opt/openjdk@17', label: 'Homebrew openjdk@17' },
      { path: '/usr/local/opt/openjdk@17', label: 'Homebrew openjdk@17' },
      { path: path.join(process.env.HOME || '', '.jdks'), label: 'User .jdks' }
    );
  } else {
    // Linux JVM directories
    const jvmParent = '/usr/lib/jvm';
    if (fs.existsSync(jvmParent)) {
      try {
        const entries = fs.readdirSync(jvmParent);
        for (const entry of entries) {
          potentialJdkLocations.push({
            path: path.join(jvmParent, entry),
            label: `Linux JVM (${entry})`
          });
        }
      } catch {}
    }
    potentialJdkLocations.push(
      { path: '/opt/jdk-17', label: 'Linux /opt/jdk-17' },
      { path: '/opt/jdk17', label: 'Linux /opt/jdk17' },
      { path: '/opt/java-17', label: 'Linux /opt/java-17' },
      { path: path.join(process.env.HOME || '', '.jdks'), label: 'User .jdks' }
    );
  }

  // Sort candidates so directories with '17' or 'jdk-17' or 'temurin-17' in their name are evaluated first
  potentialJdkLocations.sort((a, b) => {
    const aHas17 = /(?:^|[^\d])17(?:[^\d]|$)/i.test(a.path);
    const bHas17 = /(?:^|[^\d])17(?:[^\d]|$)/i.test(b.path);
    if (aHas17 && !bHas17) return -1;
    if (!aHas17 && bHas17) return 1;
    return 0;
  });

  for (const loc of potentialJdkLocations) {
    const candidateResult = evaluateCandidate(loc.path, loc.label);
    if (candidateResult) {
      // Set JAVA_HOME and prepend to PATH
      process.env.JAVA_HOME = candidateResult.javaHome;
      const binDir = path.join(candidateResult.javaHome, 'bin');
      if (!process.env.PATH?.includes(binDir)) {
        process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
      }
      return {
        compatible: true,
        javaHome: candidateResult.javaHome,
        majorVersion: candidateResult.majorVersion,
        versionString: candidateResult.versionString,
        source: candidateResult.source,
        incompatibleFound: null
      };
    }
  }

  // Priority 3: Android Studio bundled JBR (ONLY accepted if it is Java 17)
  const androidStudioJbrLocations = isWin
    ? [
        'C:\\Program Files\\Android\\Android Studio\\jbr',
        'C:\\Program Files\\Android\\Android Studio\\jre',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jre'),
        'C:\\Program Files\\Android\\Android Studio 1\\jbr',
        'C:\\Program Files\\Android\\Android Studio 2\\jbr'
      ]
    : process.platform === 'darwin'
    ? [
        '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
        '/Applications/Android Studio.app/Contents/jre/Contents/Home'
      ]
    : [
        '/usr/local/android-studio/jbr',
        '/opt/android-studio/jbr',
        path.join(process.env.HOME || '', 'android-studio', 'jbr')
      ];

  for (const jbrPath of androidStudioJbrLocations) {
    const jbrResult = evaluateCandidate(jbrPath, 'Android Studio JBR');
    if (jbrResult) {
      process.env.JAVA_HOME = jbrResult.javaHome;
      const binDir = path.join(jbrResult.javaHome, 'bin');
      if (!process.env.PATH?.includes(binDir)) {
        process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
      }
      return {
        compatible: true,
        javaHome: jbrResult.javaHome,
        majorVersion: jbrResult.majorVersion,
        versionString: jbrResult.versionString,
        source: 'Android Studio JBR (Java 17)',
        incompatibleFound: null
      };
    }
  }

  // Priority 4: System PATH 'java'
  try {
    const whichCmd = isWin ? 'where java.exe' : 'which java';
    const whichOut = spawnSync(whichCmd, { shell: true, encoding: 'utf8', timeout: 3000 });
    if (whichOut && whichOut.status === 0 && whichOut.stdout) {
      const firstBinary = whichOut.stdout.trim().split(/\r?\n/)[0];
      if (firstBinary && fs.existsSync(firstBinary)) {
        const pathResult = evaluateCandidate(firstBinary, 'System PATH');
        if (pathResult) {
          process.env.JAVA_HOME = pathResult.javaHome;
          return {
            compatible: true,
            javaHome: pathResult.javaHome,
            majorVersion: pathResult.majorVersion,
            versionString: pathResult.versionString,
            source: 'System PATH (Java 17)',
            incompatibleFound: null
          };
        }
      }
    }
  } catch {}

  // No compatible Java 17 was found
  // Prioritize primaryIncompatible: JAVA_HOME first, then System PATH, then Android Studio JBR, then first candidate
  const primaryIncompatible = incompatibleList.find(i => i.source?.includes('JAVA_HOME'))
    || incompatibleList.find(i => i.source?.includes('System PATH'))
    || incompatibleList.find(i => i.source?.includes('Android Studio JBR'))
    || incompatibleList[0]
    || null;

  return {
    compatible: false,
    javaHome: null,
    majorVersion: primaryIncompatible ? primaryIncompatible.majorVersion : null,
    versionString: primaryIncompatible ? primaryIncompatible.versionString : null,
    source: primaryIncompatible ? primaryIncompatible.source : null,
    primaryIncompatible,
    incompatibleList
  };
}

/**
 * Auto-detect and configure JAVA_HOME if a compatible Java 17 runtime exists.
 */
export function ensureJavaHome() {
  const javaInfo = detectJavaRuntime();
  if (javaInfo.compatible && javaInfo.javaHome) {
    process.env.JAVA_HOME = javaInfo.javaHome;
    const binDir = path.join(javaInfo.javaHome, 'bin');
    if (!process.env.PATH?.includes(binDir)) {
      process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
    }
    return javaInfo.javaHome;
  }
  return null;
}

/**
 * Check if a zip / jar file has valid ZIP central directory signature (not corrupt).
 */
export function isValidZip(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    if (stats.size < 1000) return false;

    // Read end of file to find EOCD signature: 0x06054b50
    const fd = fs.openSync(filePath, 'r');
    const bufferSize = Math.min(stats.size, 65536);
    const buffer = Buffer.alloc(bufferSize);
    fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
    fs.closeSync(fd);

    const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const index = buffer.lastIndexOf(eocdSignature);
    if (index === -1) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * ONE Centralized, resilient function for executing Gradle across all platforms,
 * flawlessly handling paths containing spaces on Windows, macOS, and Linux,
 * and passing the explicit JAVA_HOME environment variable to the Gradle process.
 */
export function executeGradle(gradleCmd, gradleArgs = [], cwd = androidDir, timeout = undefined) {
  const javaInfo = detectJavaRuntime();
  const runtimeEnv = { ...process.env };

  if (javaInfo.compatible && javaInfo.javaHome) {
    runtimeEnv.JAVA_HOME = javaInfo.javaHome;
    const binDir = path.join(javaInfo.javaHome, 'bin');
    if (!runtimeEnv.PATH?.includes(binDir)) {
      runtimeEnv.PATH = `${binDir}${path.delimiter}${runtimeEnv.PATH || ''}`;
    }
  }

  if (isWin) {
    const comSpec = process.env.ComSpec || 'cmd.exe';
    const formattedArgs = gradleArgs.map(arg => (arg.includes(' ') && !arg.startsWith('"')) ? `"${arg}"` : arg).join(' ');
    
    // Windows cmd.exe /s strips the first and last quote of the command line.
    // By wrapping the entire command line in an outer pair of quotes and passing windowsVerbatimArguments: true,
    // cmd.exe removes the outer pair and executes the quoted executable path without splitting on spaces.
    const rawCmdLine = `""${gradleCmd}" ${formattedArgs}"`;

    try {
      const res = spawnSync(comSpec, ['/d', '/s', '/c', rawCmdLine], {
        cwd,
        stdio: 'inherit',
        windowsVerbatimArguments: true,
        shell: false,
        env: runtimeEnv,
        timeout
      });

      if (res && res.status !== null) {
        return res;
      }
    } catch {}

    // Fallback for Windows: direct invocation with shell: true
    try {
      const fallbackRes = spawnSync(`"${gradleCmd}"`, gradleArgs, {
        cwd,
        stdio: 'inherit',
        shell: true,
        env: runtimeEnv,
        timeout
      });
      return fallbackRes;
    } catch (err) {
      return { status: 1, error: err };
    }
  }

  // On POSIX (macOS and Linux): invoke directly with shell: false (never split on spaces)
  return spawnSync(gradleCmd, gradleArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: runtimeEnv,
    timeout
  });
}

/**
 * Test if the Gradle wrapper in android/ is currently runnable.
 */
export function testGradleWrapper() {
  const wrapperJar = path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.jar');
  if (!isValidZip(wrapperJar)) {
    return { ok: false, reason: 'corrupted-or-missing-jar' };
  }

  const gradlewCmd = isWin ? 'gradlew.bat' : './gradlew';
  if (!isWin) {
    try {
      fs.chmodSync(path.join(androidDir, 'gradlew'), 0o755);
    } catch {}
  }

  try {
    const res = executeGradle(gradlewCmd, ['--version'], androidDir, 15000);
    if (res && res.status === 0) {
      return { ok: true, version: gradleVersion };
    }
    return { ok: false, reason: (res && res.stderr) || 'exit-code-nonzero' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * Download a file via HTTPS with redirect handling.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    function get(currentUrl, redirects = 0) {
      if (redirects > 5) {
        return reject(new Error('Too many redirects while downloading Gradle.'));
      }

      https.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return get(response.headers.location, redirects + 1);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download from ${currentUrl} (Status: ${response.statusCode})`));
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastReport = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const pct = Math.floor((downloadedBytes / totalBytes) * 100);
            if (pct >= lastReport + 20) {
              lastReport = pct;
              process.stdout.write(` [${pct}%]`);
            }
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            console.log(' [100%] Done.');
            resolve();
          });
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

/**
 * Unpack a ZIP file safely handling paths with spaces across all platforms.
 */
export function extractZip(zipPath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  if (isWin) {
    // Strategy 1: Native Windows 10/11 tar.exe (fast & handles spaces cleanly with shell: false)
    try {
      const tarRes = spawnSync('tar.exe', ['-xf', zipPath, '-C', targetDir], {
        stdio: 'ignore',
        shell: false
      });
      if (tarRes && tarRes.status === 0) return true;
    } catch {}

    // Strategy 2: PowerShell .NET ZipFile (Direct BCL call without shell string interpolation)
    try {
      const psDotNetScript = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($args[0], $args[1]);`;
      const dotNetRes = spawnSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        psDotNetScript,
        zipPath,
        targetDir
      ], {
        stdio: 'inherit',
        shell: false
      });
      if (dotNetRes && dotNetRes.status === 0) return true;
    } catch {}

    // Strategy 3: PowerShell Expand-Archive with -LiteralPath passed as distinct argv parameter
    try {
      const psExpandScript = `Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force`;
      const expandRes = spawnSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        psExpandScript,
        zipPath,
        targetDir
      ], {
        stdio: 'inherit',
        shell: false
      });
      if (expandRes && expandRes.status === 0) return true;
    } catch {}

    throw new Error(`Failed to extract ${zipPath} on Windows. Ensure PowerShell or tar is available.`);
  } else {
    // Unix / macOS: unzip or tar (with shell: false to protect paths with spaces)
    try {
      const unzipRes = spawnSync('unzip', ['-q', '-o', zipPath, '-d', targetDir], {
        stdio: 'ignore',
        shell: false
      });
      if (unzipRes && unzipRes.status === 0) return true;
    } catch {}

    try {
      const tarRes = spawnSync('tar', ['-xf', zipPath, '-C', targetDir], {
        stdio: 'ignore',
        shell: false
      });
      if (tarRes && tarRes.status === 0) return true;
    } catch {}

    throw new Error(`Failed to extract ${zipPath}. Please ensure 'unzip' or 'tar' is installed.`);
  }
}

/**
 * Ensure a working Gradle executable is available.
 * Returns { cmd: string, isWrapper: boolean, version: string }.
 */
export async function ensureGradleExecutable() {
  ensureJavaHome();

  // 1. First, check if the Gradle Wrapper is already functional
  const wrapperStatus = testGradleWrapper();
  if (wrapperStatus.ok) {
    return {
      cmd: isWin ? 'gradlew.bat' : './gradlew',
      cwd: androidDir,
      isWrapper: true,
      version: gradleVersion
    };
  }

  console.log(`ℹ️ Gradle wrapper in android/ needs local tooling fallback (${wrapperStatus.reason || 'unverified'}).`);

  // 2. Check if Gradle 8.14.3 is already downloaded and extracted in .gradle-tooling/
  const localGradleBinDir = path.join(toolingDir, `gradle-${gradleVersion}`, 'bin');
  const localGradleExecutable = path.join(localGradleBinDir, isWin ? 'gradle.bat' : 'gradle');

  if (fs.existsSync(localGradleExecutable)) {
    if (!isWin) {
      try {
        fs.chmodSync(localGradleExecutable, 0o755);
      } catch {}
    }

    return {
      cmd: localGradleExecutable,
      cwd: androidDir,
      isWrapper: false,
      version: gradleVersion
    };
  }

  // 3. Download official Gradle 8.14.3 distribution directly from services.gradle.org
  console.log(`▶ Downloading official Gradle ${gradleVersion} from https://services.gradle.org/...`);
  fs.mkdirSync(toolingDir, { recursive: true });
  const zipPath = path.join(toolingDir, `gradle-${gradleVersion}-bin.zip`);

  await downloadFile(gradleDistUrl, zipPath);

  if (!isValidZip(zipPath)) {
    throw new Error(`Downloaded Gradle zip is corrupted or invalid. URL: ${gradleDistUrl}`);
  }

  console.log('▶ Extracting local Gradle toolchain...');
  extractZip(zipPath, toolingDir);

  if (!fs.existsSync(localGradleExecutable)) {
    throw new Error(`Gradle executable not found at ${localGradleExecutable} after extraction.`);
  }

  if (!isWin) {
    try {
      fs.chmodSync(localGradleExecutable, 0o755);
    } catch {}
  }

  console.log(`✅ Gradle ${gradleVersion} is ready in ${toolingDir}.`);

  return {
    cmd: localGradleExecutable,
    cwd: androidDir,
    isWrapper: false,
    version: gradleVersion
  };
}

