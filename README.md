# RaspDac Mini OLED for moOde Audio 8+

![This is the correct hardware](https://www.audiophonics.fr/img/cms/Images/Produits/13K/13300/rdmoled.png)


## Usage : 
- You should use this on a fresh moOde Audio 8+ image.
- There is no need to configure anything from the WebUi. All DAC functions and MPD are pre-configured with this script.
- If this set of file is not working on your moOde Audio version, you should try to rebuild the patch from [source](https://github.com/audiophonics/RaspDacMini/tree/v2.1).
- This has not been tested on moOde < 8

## How to install : 
- Connect to your RDM OLED through SSH and run the following commands : 
```
wget https://github.com/audiophonics/RaspDacMini/archive/moode.zip

unzip moode.zip

cd RaspDacMini-moode

sudo sh install_rdm_moode.sh

```
- Display should turn on after a couple minutes.
- Remote and DAC need a reboot to be fully working.
    - Note that after running the install_rdm_moode script, the device will reboot 2 times automatically to finalize the install. 
    - You may have to reboot yet a third time before the display can properly read volume settings. 
```
sudo reboot
```

## What does it do : 
- Automatic configuration of snd-config within moOde (I2S output & MPD DSD). 
    - Exposes a script to configure the DAC functions. Run ```apessq2m help``` to get more details.
- Installation of a precompiled NodeJS RPIO driver. Creation of a systemd service to run the OLED Script during boot.
    - Exposes a script to configure basic OLED functions. Run ```rdmoled``` to get more details.
    - You can disable / enable the display by running ```sudo systemctl disable oled```  / ```sudo systemctl enable oled```
- Installation LIRC from apt. Creation a systemd service to run LIRC & IREXEC during boot.

## Tested on  : 
- moOde Audio 8.00 & RPI 3B+
- moOde Audio 8.00 & RPI 4B Revision 1.4

