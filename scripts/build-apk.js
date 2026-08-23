#!/usr/bin/env node

/**
 * SKmart POS - Automated Cross-Platform Android APK Builder
 * Builds React assets with Vite, syncs Capacitor Android, auto-resolves Gradle 8.14.3,
 * and compiles the ready-to-use debug APK.
 * 
 * Fully hardened against paths containing spaces on Windows, macOS, and Linux.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ensureGradleExecutable, detectJavaRuntime, executeGradle } from './gradle-manager.js';

const isWin = process.platform === 'win32';
const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');

console.log('\n======================================================');
console.log('       SKmart POS - Android APK Build Pipeline        ');
console.log('======================================================\n');

// Helper to run sequential steps safely with spaces
function runStep(title, command, args, cwd = rootDir) {
  console.log(`▶ [Step] ${title}...`);
  
  // On Windows, resolve npm.cmd / npx.cmd if command is npm/npx
  let execCmd = command;
  if (isWin) {
    if (command === 'npm') execCmd = 'npm.cmd';
    if (command === 'npx') execCmd = 'npx.cmd';
  }

  const res = spawnSync(execCmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env }
  });

  if (res.status !== 0) {
    // Fallback with shell if direct binary resolution is handled by cmd
    const fallbackRes = spawnSync(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env }
    });

    if (fallbackRes.status !== 0) {
      console.error(`\n❌ Error during: ${title}`);
      process.exit(fallbackRes.status || 1);
    }
  }
}

// Ensure generated Capacitor Gradle files target Java 17 LTS
function normalizeProjectJava17Compatibility() {
  const capBuildGradle = path.join(androidDir, 'app', 'capacitor.build.gradle');
  if (fs.existsSync(capBuildGradle)) {
    try {
      let content = fs.readFileSync(capBuildGradle, 'utf8');
      if (content.includes('JavaVersion.VERSION_21')) {
        content = content.replace(/JavaVersion\.VERSION_21/g, 'JavaVersion.VERSION_17');
        fs.writeFileSync(capBuildGradle, content, 'utf8');
        console.log('ℹ️ Verified Java 17 LTS target in android/app/capacitor.build.gradle');
      }
    } catch {}
  }
}

// Auto-configure local.properties if Android SDK is detected on system
function autoConfigureLocalProperties() {
  const localPropsPath = path.join(androidDir, 'local.properties');
  if (!fs.existsSync(localPropsPath)) {
    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    const defaultSdkPath = isWin
      ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
      : path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');

    const sdkPath = (androidHome && fs.existsSync(androidHome))
      ? androidHome
      : (fs.existsSync(defaultSdkPath) ? defaultSdkPath : null);

    if (sdkPath) {
      try {
        // Gradle properties files on Windows accept standard forward slashes seamlessly, avoiding escape conflicts
        const forwardSlashPath = sdkPath.replace(/\\/g, '/');
        fs.writeFileSync(localPropsPath, `sdk.dir=${forwardSlashPath}\n`);
        console.log(`ℹ️ Configured android/local.properties -> ${forwardSlashPath}`);
      } catch {}
    }
  }
}

async function main() {
  // 1. Build Vite Web Assets
  runStep('Building React Web Application (Vite)', 'npm', ['run', 'build']);

  // 2. Sync Capacitor Android
  runStep('Syncing Capacitor Android Plugins & Assets', 'npx', ['cap', 'sync', 'android']);
  normalizeProjectJava17Compatibility();

  // 3. Auto-configure and verify Java 17 Runtime & Android SDK
  const javaInfo = detectJavaRuntime();
  if (!javaInfo.compatible || !javaInfo.javaHome) {
    console.error('\n❌ Build Aborted: Compatible Java 17 Runtime Required');
    if (javaInfo.primaryIncompatible) {
      const detectedVer = javaInfo.primaryIncompatible.majorVersion
        ? `Java ${javaInfo.primaryIncompatible.majorVersion}`
        : 'Incompatible Java';
      console.error(`   Detected: ${detectedVer} (${javaInfo.primaryIncompatible.versionString})`);
      console.error(`   Location: ${javaInfo.primaryIncompatible.javaHome}`);
      console.error(`   Source:   ${javaInfo.primaryIncompatible.source}`);
      console.error(`\n   Reason: Gradle 8.14.3 requires Java 17 for Android builds.`);
      console.error(`   Java 25 / class file major version 69 is not supported by Gradle 8.14.3.`);
    } else {
      console.error('   No JDK 17 was detected on this system.');
    }
    console.error('\n💡 Solution: Install Eclipse Adoptium Temurin 17 (JDK 17 LTS):');
    console.error('   • Download: https://adoptium.net/temurin/releases/?version=17');
    if (isWin) {
      console.error('   • Windows Package Manager: winget install EclipseAdoptium.Temurin.17.JDK');
    }
    console.error('   • After installation, set JAVA_HOME to the JDK 17 path or run "npm run doctor".\n');
    process.exit(1);
  }

  console.log(`ℹ️ Java Runtime: Java 17 (${javaInfo.versionString}) via ${javaInfo.javaHome}`);
  autoConfigureLocalProperties();

  // 4. Resolve / Bootstrap Gradle 8.14.3
  console.log('▶ [Step] Checking Gradle Build Toolchain...');
  let gradleTool;
  try {
    gradleTool = await ensureGradleExecutable();
  } catch (err) {
    console.error(`\n❌ Could not initialize Gradle toolchain: ${err.message}`);
    console.error('\nTips:');
    console.error(' 1. Run "npm run doctor" to check Java JDK and SDK paths.');
    console.error(' 2. Ensure you have an active internet connection to download official Gradle 8.14.3 binary on the first build.\n');
    process.exit(1);
  }

  // 5. Execute Gradle assembleDebug via the centralized space-safe runner
  console.log(`\n▶ [Step] Building Android APK with Gradle (${gradleTool.isWrapper ? 'Gradle Wrapper' : 'Local Gradle 8.14.3'})...`);
  const gradleArgs = ['assembleDebug'];

  const gradleRes = executeGradle(gradleTool.cmd, gradleArgs, androidDir);

  if (gradleRes.status !== 0) {
    console.error('\n❌ Gradle build encountered an error.');
    console.error('Tips:');
    console.error(' 1. Run "npm run doctor" to verify Java & Android SDK configuration.');
    console.error(' 2. Open Android Studio via "npm run cap:open" to verify SDK installation.\n');
    process.exit(gradleRes.status || 1);
  }

  // 6. Verify Output APK
  const expectedApkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

  if (fs.existsSync(expectedApkPath)) {
    const stats = fs.statSync(expectedApkPath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log('\n======================================================');
    console.log('🎉 BUILD SUCCESSFUL! Android APK Ready:');
    console.log(`📍 Path: ${expectedApkPath}`);
    console.log(`📦 Size: ${sizeMb} MB`);
    console.log('======================================================\n');
  } else {
    console.log('\n✅ Build step completed. Check android/app/build/outputs/apk/debug/ for the APK.\n');
  }
}

main().catch((err) => {
  console.error('Unexpected build failure:', err);
  process.exit(1);
});
