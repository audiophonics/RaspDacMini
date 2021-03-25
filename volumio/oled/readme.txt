OLED RaspDAC Mini installer

Details --------------------------------------------------------------

Device		:  	Audiophonics RaspDAC MINI OLED with Raspberry Pi4
Distribution	:  	Volumio
Version		: 	2.01
Author 		:	Olivier Schwach
Date (d/m/y) 	: 	25/03/2021

Abstract --------------------------------------------------------------

Use this script on a fresh Volumio install to add support for Audiophonics EVO SABRE secondary display.

Software (python) uses API(s) available in the distribution to gather and display data regarding playback, sampling rate, volume...etc. 
This script contains a set of instruction for automatic installation of this software for a Volumio distribution running on a Raspberry Pi4 mounted on Audiophonics RaspDac Mini module

Usage -----------------------------------------------------------------

- Make sure networking is enabled and your Pi has internet access
- Run installation script as root 
- sudo bash install
- Reboot and OLED should be working

Tested versions -------------------------------------------------------
(see https://community.volumio.org/t/volumio-changelog)

-	OK	Volumio 2.853
- 	OK 	Volumio 2.861
- 	OK 	Volumio 2.873
		
Maintenance notes  ----------------------------------------------------

#2.00 / python dependencies 
Issue => libssl default version (even updated from repo) does not meet requirements for installing via pip. 
Solution => Luckily there is a backport available. But since Raspbian Jessie is on archive already, it is necessary to allow packages from http://archive.debian.org/debian/ jessie-backports (done in install.sh script)

#2.01 / feature
Script now listen to unix socket to receive external commands and have its own section in audiophonics web interface if installed
