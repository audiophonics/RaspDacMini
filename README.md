# RaspDac Mini OLED for Volumio 3

![This is the correct hardware](https://www.audiophonics.fr/img/cms/Images/Produits/13K/13300/rdmoled.png)


## Usage : 
- You should use this on a fresh Volumio 3 image.
- There is no need to configure anything from the WebUi. All DAC functions and MPD are pre-configured with this script.
- If this set of file is not working on your Volumio version, you should try to rebuild the patch from [source](https://github.com/audiophonics/RaspDacMini/tree/v2.1).
- This was not designed for Volumio 2.

## How to install : 
- Connect to your RDM OLED through SSH and run the following commands : 
```
git clone https://github.com/audiophonics/RaspDacMini.git --branch volumio --single-branch

cd RaspDacMini

sudo sh install_rdm_volumio.sh

```
- Display should turn on after a couple seconds.
- Remote and DAC need a reboot to be fully working.
```
sudo reboot
```

## What does it do : 
- Automatic configuration of alsa controller within Volumio (I2S output & DSD). 
    - Exposes a script to configure the DAC functions. Run ```apessq2m help``` to get more details.
- Installation of a precompiled NodeJS RPIO driver. Creation of a systemd service to run the OLED Script during boot.
    - Exposes a script to configure basic OLED functions. Run ```rdmoled``` to get more details.
    - You can disable / enable the display by running ```sudo systemctl disable oled```  / ```sudo systemctl enable oled```
- Installation LIRC from apt. Creation a systemd service to run LIRC & IREXEC during boot.

## Tested on  : 
- Volumio 3.233 & RPI 4 Revision 1.5
- Volumio 3.233 & RPI 3B+

## Why this was so long to be released ?  
- There already were minor differences between Pi3B+ and Pi4 version that are really hard to handle in a way that does not require maintaining 2 separate versions (I do not want that).
- Then I found the SPI kernel module to be way less reliable in Volumio3 so I had to rewrite the OLED driver with pure bitbanging (which works surprisingly better without needing a reboot so it turns out this part is 100% an upgrade).
- Then I found issues with 1.5 Raspberry Pi 4 revision.
- All of this must be able to work on moOde Audio as well.

All those reasons made testing and debugging extremely long and tedious. I apologize for the time it took.
