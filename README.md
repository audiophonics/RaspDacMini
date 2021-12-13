# RaspDac Mini
Toolset and sources file used for customizing RPI audio distributions with RaspDac Mini hardware support 

This repository holds sources and methods for installing the specific hardware found in a RaspDac Mini  (display, remote control) and some utilities in a fresh distribution for audio playback on raspberry pi. 

## Currently supported : 

### No, this is not working on Volumio 3 yet. Please be patient. 

### Volumio & moOde audio
* Installation of OLED Display
* Installation of IR remote
* Installation of aptswi (web interface with some system options) 
  
## Important notes : 
To avoid conflicts it is recommanded to use this toolset on a **fresh** (non-customized) release. 
It is strongly advised to back-up configuration file and your local music library before installing anything with this toolset.

Some devices require the audio output to be already configured with the ES9038 driver to work. You should do this in your regular distribution interface **before** running any customization script.

**Remember your device must have network access to download dependencies.** This toolset is not designed for offline installation.

## Usage : 

* Update package repo list
```bash
sudo apt-get update
```

* Download source files (this repository).
```bash
git clone http://github.com/audiophonics/RaspDacMini
```
* Enter directory.
```bash
cd RaspDacMini
```
* Each supported distribution has its own directory, enter the one corresponding to the distribution installed on your RaspDac Mini. 
```bash
# for Volumio
cd volumio

# for moOde
cd moode
```
* Run the installation script **as root** to install all available features
```bash
sudo bash install.sh
```

*most scripts deal with hardware configuration and will require you to reboot after completion. A successful script installation will explicitely notify you from terminal if a reboot is needed.*

## Install duration :
Some scripts and core functionnalities automatically download and compile frameworks from source. This is due to the wide range of Linux flavors that are found across the audio distributions for raspberry pi and the different rate at which updates happen. Since the defaults packages and libraries natively available on those systems can vary a lot, do not expect installation time to be consistent from one distribution to another.
