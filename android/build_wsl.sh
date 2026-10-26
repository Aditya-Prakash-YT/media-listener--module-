#!/usr/bin/env bash
set -e
source /home/aditya8prakash/.nvm/nvm.sh
nvm use 22
export ANDROID_HOME=/home/aditya8prakash/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

cd "$(dirname "$0")"
./gradlew assembleDebug
