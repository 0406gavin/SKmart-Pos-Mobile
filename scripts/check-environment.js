#!/usr/bin/env node

/**
 * SKmart POS - Environment Doctor & Diagnostics
 * Beginner-friendly environment checker for Android APK builds.
 */

import fs from 'fs';
import path from 'path';
import { detectJavaRuntime, isValidZip } from './gradle-manager.js';

const isWin = process.platform === 'win32';
const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const toolingDir = path.join(rootDir, '.gradle-tooling');

console.log('\n======================================================');
console.log('       SKmart POS - Environment Diagnostics          ');
console.log('======================================================\n');

let issuesFound = 0;

// 1. Node.js Check
try {
  const nodeVer = process.version;
  const major = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
  if (major >= 18) {
    console.log(`✅ Node.js: Detected ${nodeVer} (Recommended: Node 20 LTS)`);
  } else {
    console.log(`⚠️ Node.js: Detected ${nodeVer}. Recommended: Node.js 20 LTS or newer.`);
  }
} catch {
  console.log('❌ Node.js: Unable to detect Node.js version.');
  issuesFound++;
}

// 2. Java / JDK 17 Check
const javaInfo = detectJavaRuntime();

if (javaInfo.compatible && javaInfo.javaHome) {
  console.log(`✅ Java Runtime: Java ${javaInfo.majorVersion} (${javaInfo.versionString})`);
  console.log(`   Java Path: ${javaInfo.javaHome}`);
  console.log(`   Source: ${javaInfo.source}`);
  console.log(`   Status: Compatible with Gradle 8.14.3`);
} else {
  issuesFound++;
  if (javaInfo.primaryIncompatible) {
    const detectedLabel = javaInfo.primaryIncompatible.majorVersion
      ? `Java ${javaInfo.primaryIncompatible.majorVersion}`
      : 'Incompatible Java';

    console.log(`❌ Java Runtime: ${detectedLabel} detected (${javaInfo.primaryIncompatible.versionString})`);
    console.log(`   Java Path: ${javaInfo.primaryIncompatible.javaHome}`);
    console.log(`   Source: ${javaInfo.primaryIncompatible.source}`);
    console.log(`   Status: Incompatible (Gradle 8.14.3 requires Java 17)`);
    console.log(`   Issue: Gradle 8.14.3 fails with ${detectedLabel} ("Unsupported class file major version").`);
    console.log('\n   💡 Quick Solution: Install Eclipse Adoptium Temurin 17 (JDK 17 LTS):');
    console.log('      • Official Download: https://adoptium.net/temurin/releases/?version=17');
    if (isWin) {
      console.log('      • Windows Package Manager: winget install EclipseAdoptium.Temurin.17.JDK');
    }
    console.log('      • Note: Once installed, the build script will automatically detect it (no manual set JAVA_HOME needed).');
  } else {
    console.log('❌ Java Runtime: Java JDK 17 was not detected on this system.');
    console.log('   Status: Incompatible (Gradle 8.14.3 requires Java 17)');
    console.log('\n   💡 Quick Solution: Install Eclipse Adoptium Temurin 17 (JDK 17 LTS):');
    console.log('      • Official Download: https://adoptium.net/temurin/releases/?version=17');
    if (isWin) {
      console.log('      • Windows Package Manager: winget install EclipseAdoptium.Temurin.17.JDK');
    }
    console.log('      • Note: Once installed, the build script will automatically detect it (no manual set JAVA_HOME needed).');
  }
}

// 3. Android SDK Check
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const defaultSdkPath = isWin
  ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
  : path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');

if (androidHome && fs.existsSync(androidHome)) {
  console.log(`✅ Android SDK: Found at ${androidHome}`);
} else if (fs.existsSync(defaultSdkPath)) {
  console.log(`✅ Android SDK: Found default installation at ${defaultSdkPath}`);
} else {
  console.log('ℹ️ Android SDK: Custom ANDROID_HOME not set. Android Studio manages this automatically.');
}

// 4. Android Project Structure Check
if (fs.existsSync(androidDir)) {
  console.log('✅ Android Project: Present (Capacitor Android Project)');
} else {
  console.log('❌ Android Project: "android/" directory is missing.');
  issuesFound++;
}

// 5. Project Java Configuration Check
try {
  const rootBuildGradle = path.join(androidDir, 'build.gradle');
  const appBuildGradle = path.join(androidDir, 'app', 'build.gradle');
  const capBuildGradle = path.join(androidDir, 'app', 'capacitor.build.gradle');
  
  let rootEnforces17 = false;
  let appTargets17 = false;
  let rawJava21Found = false;

  if (fs.existsSync(rootBuildGradle)) {
    const rootContent = fs.readFileSync(rootBuildGradle, 'utf8');
    if (rootContent.includes('JavaVersion.VERSION_17') && rootContent.includes('subprojects')) {
      rootEnforces17 = true;
    }
  }

  if (fs.existsSync(appBuildGradle)) {
    const appContent = fs.readFileSync(appBuildGradle, 'utf8');
    if (appContent.includes('JavaVersion.VERSION_17')) {
      appTargets17 = true;
    }
  }

  if (fs.existsSync(capBuildGradle)) {
    const capContent = fs.readFileSync(capBuildGradle, 'utf8');
    if (capContent.includes('JavaVersion.VERSION_21')) {
      rawJava21Found = true;
    }
  }

  if (rootEnforces17 && appTargets17) {
    console.log('✅ Project Java & Kotlin Target: Configured for Java 17 / JVM 17 LTS (overrides Capacitor 8 default Java 21)');
  } else if (!rootEnforces17 && rawJava21Found) {
    console.log('⚠️ Project Java & Kotlin Target: Found Java 21 directives in Capacitor build scripts without global Java 17 override.');
    issuesFound++;
  } else {
    console.log('✅ Project Java & Kotlin Target: Java 17 / JVM 17 LTS compatible');
  }
} catch {
  console.log('ℹ️ Project Java Target: Could not inspect gradle files.');
}

// 6. Gradle Build Toolchain Check
const wrapperJar = path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.jar');
const localGradleBin = path.join(toolingDir, 'gradle-8.14.3', 'bin', isWin ? 'gradle.bat' : 'gradle');

if (fs.existsSync(localGradleBin)) {
  console.log('✅ Gradle Engine: Local Gradle 8.14.3 is cached and ready in .gradle-tooling/');
} else if (fs.existsSync(wrapperJar) && isValidZip(wrapperJar)) {
  console.log('✅ Gradle Wrapper: Valid (43 KB)');
} else {
  console.log('ℹ️ Gradle Engine: Will be auto-downloaded on first "npm run build:apk" from services.gradle.org (no global install needed).');
}

// Summary
console.log('\n------------------------------------------------------');
if (issuesFound === 0) {
  console.log('🎉 System Ready! You can build the APK by running:');
  console.log('   npm run build:apk');
} else {
  console.log(`⚠️ Found ${issuesFound} warning(s) or issue(s) above.`);
  console.log('   Follow the setup guide in README.md.');
}
console.log('------------------------------------------------------\n');

