# Experiment environment setup on macOS and Linux

Open Terminal. Install Git, [Python 3.10 or newer](https://www.python.org/downloads/), [Node.js 22 and npm](https://nodejs.org/en/download), and a [JDK 17](https://adoptium.net/installation/). On macOS, the Git developer tools are available through xcode-select --install. On Debian or Ubuntu, install git, python3, python3-venv, and openjdk-17-jdk through apt. Use the Node.js downloads page to select the 22.x build for your architecture if your distro supplies a different major release. On other Linux distributions, use the equivalent packages.

## 1. Check the tools and build the modules

On macOS, run export JAVA_HOME=$(/usr/libexec/java_home -v 17) to select JDK 17. On Linux, set JAVA_HOME to the actual JDK installation directory, such as /usr/lib/jvm/java-17-openjdk-amd64 on Debian x86-64. The experiment launchers that invoke Python by name also need a python executable. If your system supplies only python3, create a virtual environment and activate it before using the run instructions.

~~~sh
git --version
python3 --version
node --version
npm --version
node --experimental-strip-types -e 'console.log("TypeScript stripping available")'
java -version
javac -version
jar --version

# Skip the clone if you already have a checkout.
git clone https://github.com/mikevan/Intellectus.git
cd Intellectus
git rev-parse HEAD

python3 -m venv .venv
. .venv/bin/activate
python --version

npm --prefix Understanding ci && npm --prefix Understanding run build
npm --prefix complexity ci && npm --prefix complexity run build
~~~

## 2. Install and check Apache Karaf

Download the [Apache Karaf 4.4.13 binary tar.gz and SHA-512 checksum](https://karaf.apache.org/download.html) into the same directory. In that directory run the following with your JDK 17 selected.

~~~sh
archive=apache-karaf-4.4.13.tar.gz
expected=$(grep -Eo '[a-fA-F0-9]{128}' "$archive.sha512" | head -n 1 | tr 'A-F' 'a-f')
actual=$(shasum -a 512 "$archive" | awk '{print $1}')
test -n "$expected" && test "$actual" = "$expected" &&
    mkdir -p "$HOME/.local/opt" &&
    tar -xzf "$archive" -C "$HOME/.local/opt" &&
    "$HOME/.local/opt/apache-karaf-4.4.13/bin/karaf"
~~~

On Linux without shasum, use sha512sum in its place. In Karaf, run shell:info and confirm Karaf 4.4.13 and Java 17, then enter shutdown -f. The RT-2 through RT-4 historical launchers and archived verifiers use Windows-specific paths. Installing Karaf locally prepares the OSGi runtime, but does not port those experiment harnesses.

## 3. Install and check Colibri

Follow the [Colibri macOS/Linux guide](colibri-mac-linux.md) for the runtime, Qwen checkpoint, and smoke test. Then choose an experiment in the [run instructions](experiment-runs.md).
