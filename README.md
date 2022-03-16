# RaspDac Mini OLED for Volumio 3

## Usage : 
- You should use this on a fresh Volumio 3 image.
- There is no need to configure anything from the WebUi. All DAC functions and MPD are pre-configured with this script.
- If this set of file is not working on your Volumio version, you should try to rebuild the patch from [source](https://github.com/audiophonics/RaspDacMini/tree/v2.1).
- This was not designed for Volumio 2.

## How to use : 
- Connect to your RDM OLED through SSH and run the following commands : 
```
git clone https://github.com/audiophonics/RaspDacMini.git --branch volumio --single-branch

cd RaspDacMini

sudo sh install_rdm_volumio.sh
```

## Tested on  : 
- Volumio 3.233 & RPI 4 Revision 1.5
