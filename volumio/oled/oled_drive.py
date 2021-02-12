#!/usr/bin/env python
# -*- coding: utf-8 -*-
# AUDIOPHONICS RASPDAC MINI OLED Script #
# 11 Septembre 2018 
# UPDATE V1.1 :
# 18 Fevrier 2019
# Qobuz et Spotify support

from __future__ import unicode_literals
import sys

import os
import time
import socket
import re
import subprocess
import json
import urllib.request as url 
from subprocess import Popen, PIPE

from PIL import Image
from PIL import ImageFont
from PIL import ImageDraw

from luma.core.interface.serial import spi
from luma.core.render import canvas
from luma.oled.device import ssd1306
import RPi.GPIO as GPIO
serial = spi(port=0, device=0, gpio_DC=27, gpio_RST=24)
device = ssd1306(serial, rotate=2)

mpd_music_dir		= "/var/lib/mpd/music/"
title_height		= 40
scroll_unit		= 2
oled_width		= 128
oled_height		= 64

def make_font(name, size):
    font_path = os.path.abspath(os.path.join(
        os.path.dirname(__file__), 'fonts', name))
    return ImageFont.truetype(font_path, size)

font_title              = make_font('msyh.ttf', 26)
font_info		= make_font('msyh.ttf', 18)
font_vol		= make_font('msyh.ttf', 55)
font_ip			= make_font('msyh.ttf', 15)
font_time		= make_font('msyh.ttf', 15)
font_20			= make_font('msyh.ttf', 18)
font_date		= make_font('arial.ttf', 25)
#font_logo		= make_font('msyh.ttf', 24)
font_logo		= make_font('arial.ttf', 21)
font_32			= make_font('arial.ttf', 32)
awesomefont		= make_font("fontawesome-webfont.ttf", 14)

speaker			= "\uf028"
wifi			= "\uf1eb"
link			= "\uf0e8"
clock			= "\uf017"

mpd_host		= 'localhost'
mpd_port		= 6600
mpd_bufsize		= 8192

def getWanIP():
    #can be any routable address,
    fakeDest = ("223.5.5.5", 53)
    wanIP = ""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(fakeDest)
        wanIP = s.getsockname()[0]
        s.close()
    except:
        pass
    return wanIP

def GetLANIP():
   cmd = "ip addr show eth0 | grep inet  | grep -v inet6 | awk '{print $2}' | cut -d '/' -f 1"
   p = Popen(cmd, shell=True, stdout=PIPE)
   output = p.communicate()[0]
   return output[:-1]
   
def GetInput():
	cmd = "bash ap_card.sh get_input"
	p = Popen(cmd, shell=True, stdout=PIPE)
	output = p.communicate()[0]
	return output[:-1]

# OLED images
image		= Image.new('1', (oled_width, oled_height))
draw		= ImageDraw.Draw(image)
music_file	=""
shift		= 0
title_image     = Image.new('L', (oled_width, title_height))
title_offset    = 0
current_page = 0
vol_val_store = 0
screen_sleep = 0
timer_vol = 0
screensave = 3

# Socket 
soc = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
soc.connect((mpd_host, mpd_port))
soc.recv(mpd_bufsize)

soc.send(bytes('commands\n','utf-8'))
rcv = soc.recv(mpd_bufsize)
shift		= 1
music_file	= ""

spdif=False;


with canvas(device) as draw:
	draw.text((3, 10),"Audiophonics", font=font_logo,fill="white")
time.sleep(2)

try:
	while True:
		soc.send(bytes('currentsong\n',"utf-8"))
		buff  = soc.recv(mpd_bufsize)
		song_list = buff.splitlines()
		#print buff
		soc.send(bytes('status\n','utf-8'))
		buff        = soc.recv(mpd_bufsize)
		#print buff
		state_list  = buff.splitlines()
		info_state      = ""
		info_audio      = ""
		info_elapsed    = 0
		info_duration   = 0
		info_title      = ""
		info_artist     = ""
		info_album      = ""
		info_name = ""
		info_file	= ""
		bit_val		= ""
		samp_val	= ""
		time_val	= time_bar = time_min = time_sec = vol_val = audio_val = 0
		jsonapi	= json.load(url.urlopen('http://127.0.0.1:3000/api/v1/getstate'))
		

		for line in range(0,len(state_list)):
			state_list[line] = str(state_list[line],"utf-8")
			if state_list[line].startswith("state: "):     info_state      = state_list[line].replace("state: ", "")
			if state_list[line].startswith("elapsed: "):   #info_elapsed    = float(state_list[line].replace("elapsed: ", ""))

				time_val   = float(state_list[line].replace("elapsed: ", ""))
				time_bar = time_val
				time_min = time_val/60
				time_sec = time_val%60
				time_min = "%2d" %time_min
				time_sec = "%02d" %time_sec
				time_val = str(time_min)+":"+str(time_sec)
			if state_list[line].startswith("time: "):      info_duration   = float(state_list[line].split(":")[2])

			# Volume
			vol_val = str(jsonapi['volume'])
			# Volume NULL
			if vol_val == "" : 
				vol_val = "0"
				subprocess.Popen(['volumio', 'volume', '0' ])
			# Sampling rate / bit 
			if state_list[line].startswith(r"audio: "):
				audio_val = state_list[line]
				audio_val = audio_val.replace("audio: ", "")
				audio_val = re.split(':',audio_val)

				bit_val = audio_val[1]+'bit '
				if  audio_val[0] == '22050':
					samp_val = '22.05k/'
				elif audio_val[0] == '32000':
					samp_val = '32k/'
				elif audio_val[0] == '44100':
					samp_val = '44.1k/'
				elif audio_val[0] == '48000':
					samp_val = '48k/'
				elif audio_val[0] == '88200':
					samp_val = '88.2k/'
				elif audio_val[0] == '96000':
					samp_val = '96k/'
				elif audio_val[0] == '176400':
					if audio_val[1] != '32':
						samp_val = '176.4k/'
					else:
						samp_val = 'DSD64/'
						bit_val = '1bit'
				elif audio_val[0] == '192000':
					samp_val = '192k/'
				elif audio_val[0] == '352800':
					if audio_val[1] != '32':
						samp_val = '352.8k/'
					else:
						samp_val = 'DSD128/'
						bit_val = '1bit'

				elif audio_val[0] == '384000':
					samp_val = '384k/'

				elif audio_val[0] == '705600':
					if audio_val[1] != '32':
						samp_val = '705.6k/'
					else:
						samp_val = 'DSD256/'
						bit_val = '1bit'

				elif audio_val[0] == '768000':
					samp_val = '768k/'

				elif audio_val[0] == '1411200':
					samp_val = 'DSD512/'
					bit_val = '1bit'

				elif audio_val[0] == '6144000':
					samp_val = 'DSD1024/'
					bit_val = '1bit'
				else:
					samp_val = state_list[line].replace("audio: ", "")
					bit_val = ""

				if audio_val[1] == 'f':
					bit_val = '24bit'

		for song_line in range(0,len(song_list)):
			song_list[song_line] = str(song_list[song_line],"utf-8")
			if song_list[song_line].startswith("file: "):       info_file       = song_list[song_line].replace("file: ", "")
			if song_list[song_line].startswith("Artist: "):     info_artist     = song_list[song_line].replace("Artist: ", "")
			if song_list[song_line].startswith("Album: "):      info_album      = song_list[song_line].replace("Album: ", "")
			if song_list[song_line].startswith("Title: "):      info_title      = song_list[song_line].replace("Title: ", "")
			if song_list[song_line].startswith("Name: "):      info_name      = song_list[song_line].replace("Name: ", "") 
		
		## NON MPD SOURCES
		try :
			tracktype = str(jsonapi['trackType'])
		except :
			tracktype = "mpd"
		## QOBUZ
		if tracktype == "qobuz":
			info_file = "Qobuz"
			info_artist = (jsonapi['artist'])
			info_album = (jsonapi['album'])			
			info_title = (jsonapi['title'])
		## SPOTIFY
		elif tracktype == "spotify" :
			info_state = str(jsonapi['status'])
			info_file = (jsonapi['uri'])
			info_artist = (jsonapi['artist'])
			info_album = (jsonapi['album'])			
			info_title = (jsonapi['title'])
			info_duration = float((jsonapi['duration']))			
			time_val = float((jsonapi['seek']) / 1000)
			time_bar = time_val
			time_min = time_val/60
			time_sec = time_val%60
			time_min = "%2d" %time_min
			time_sec = "%02d" %time_sec
			time_val = str(time_min)+":"+str(time_sec)			
		
		# clear the image
		#draw.rectangle((0,0,oled_width,oled_height), outline=0, fill=0)
		dac_input = str(GetInput(),"utf-8")
		# Volume change screen
		if vol_val != vol_val_store : timer_vol = 20
		if timer_vol > 0 :
			with canvas(device) as draw:
				vol_width, char = font_vol.getsize(vol_val)
				x_vol = ((oled_width - vol_width) / 2)
				# Volume Display
				draw.text((0, 25), text="\uf028", font=awesomefont, fill="white")
				draw.text((x_vol, -10), vol_val, font=font_vol, fill="white")
				# Volume Bar
				draw.rectangle((120,0,127,62), outline=1, fill=0)
				Volume_bar = (58 - (int(float(vol_val)) / 1.785))
				draw.rectangle((122,Volume_bar,125,60), outline=0, fill=1)
			vol_val_store = vol_val
			timer_vol = timer_vol - 1
			screen_sleep = 0
			time.sleep(0.1)
	

		# SPDIF screen
		
		elif(dac_input == "'SPDIF'"):
			if screen_sleep < 600 :
				with canvas(device) as draw:
					draw.text((20, -4),"SPDIF", font=font_title,fill="white")
					draw.text((45, 33), vol_val, font=font_title, fill="white")
					draw.text((15, 41), text="\uf028", font=awesomefont, fill="white")
					# Volume Bar
					draw.rectangle((120,0,127,62), outline=1, fill=0)
					Volume_bar = (58 - (int(float(vol_val)) / 1.785))
					draw.rectangle((122,Volume_bar,125,60), outline=0, fill=1)				
				time.sleep(0.5)	
				screen_sleep = screen_sleep + 1
			else : 
				with canvas(device) as draw:
					draw.text((0, 48), ".", font=font_time, fill="white")
				time.sleep(1)
			

		# Play screen
		elif info_state != "stop":
			screen_sleep = 0
			
			if info_title == "" :
				name    = info_file.split('/')
				name.reverse()
				info_title  = name[0]

				try:
					info_album  = name[1]
				except:
					info_album  = ""

				try:
					info_artist = name[2]
				except:
					info_artist = ""
				
			if info_name != "" : info_artist = info_name

			if info_duration != 0 :
				time_bar = time_bar / info_duration * 128
			

			if info_file != music_file or time_bar < 5 :
				#Called one time / file
				music_file  = info_file;
				# Generate title image			
				artist_offset    = 10;
				album_offset    = 10;
				title_offset     = 10;
				title_width, char  = font_info.getsize(info_title)
				artist_width, char  = font_info.getsize(info_artist)
				album_width, char  = font_info.getsize(info_album)
				bitrate_width, char = font_time.getsize(samp_val + bit_val)
				

			# OFFSETS*****************************************************
			x_artist   = 0
			if oled_width < artist_width :
				if artist_width < -(artist_offset + 20) :
					artist_offset    = 0

				if artist_offset < 0 :
					x_artist   = artist_offset

				artist_offset    = artist_offset - scroll_unit
				
			x_album   = 0
			if oled_width < album_width :
				if album_width < -(album_offset + 20) :
					album_offset    = 0

				if album_offset < 0 :
					x_album   = album_offset

				album_offset    = album_offset - scroll_unit	
			
			x_title   = 0
			if oled_width < title_width :
				if title_width < -(title_offset + 20) :
					title_offset    = 0

				if title_offset < 0 :
					x_title   = title_offset

				title_offset    = title_offset - scroll_unit	
			
			x_bitrate = (oled_width - bitrate_width) / 2

			# artist name, album name, audio format *****************
			audio_val = state_list[line]
			audio_val = audio_val.replace("audio: ", "")
			audio_val = re.split(':',audio_val)
			
			with canvas(device) as draw:
				if current_page < 100 :	
					draw.text((x_title, 0), info_title, font=font_info, fill="white")
					if title_width < -(title_offset - oled_width) and title_width > oled_width :
						draw.text((x_title + title_width + 10,0), "- " + info_title, font=font_info, fill="white")					
					draw.text((x_bitrate, 25), (samp_val + bit_val), font=font_time, fill="white")					
					if info_state == "pause": 
						draw.text((0, 52), text="\uf04c", font=awesomefont, fill="white")
					else:
						draw.text((1, 48), time_val, font=font_time, fill="white")
					#draw.text((58, 48), text="\uf001", font=awesomefont, fill="white")	
					draw.rectangle((0,45,time_bar,47), outline=0, fill=1)
					draw.text((85, 51), text="\uf028", font=awesomefont, fill="white")	
					draw.text((101, 48), vol_val, font=font_time, fill="white")
				
					current_page = current_page + 1
					artist_offset = 10
					album_offset = 10						
		
				elif current_page < 250	:
					# artist name
					draw.text((x_artist,0), info_artist, font=font_info, fill="white")
					if artist_width < -(artist_offset - oled_width) and artist_width > oled_width :
						draw.text((x_artist + artist_width + 10,0), "- " + info_artist, font=font_info, fill="white")
					# album name
					draw.text((x_album, 20), info_album, font=font_info, fill="white")
					if album_width < -(album_offset - oled_width) and album_width > oled_width :
						draw.text((x_album + album_width + 10,20), "- " + info_album, font=font_info, fill="white")
					# Bottom line
					if info_state == "pause": 
						draw.text((0, 52), text="\uf04c", font=awesomefont, fill="white")
					else:
						draw.text((1, 48), time_val, font=font_time, fill="white")
					draw.rectangle((0,45,time_bar,47), outline=0, fill=1)
					draw.text((101, 48), vol_val, font=font_time, fill="white")
					draw.text((85, 51), text="\uf028", font=awesomefont, fill="white")
					current_page = current_page + 1
					
					if current_page == 250 :
						current_page = 0
						title_offset = 10
						
				
			time.sleep(0.05)
		else:
			# Time IP screen
			music_file  = ""
			ip = getWanIP()
			#print ip+"ok"
			#ip = str(GetLANIP())
			if screen_sleep < 20000 :
				with canvas(device) as draw:
					#draw.text((1, -6),"Volumio", font=font_logo,fill="white")
					if ip != "":
						draw.text((18, 29), ip, font=font_ip, fill="white")
						draw.text((1, 32), link, font=awesomefont, fill="white")
					else:
						draw.text((18, 29),time.strftime("192.168.211.1"), font=font_ip, fill="white")
						draw.text((1, 32), wifi, font=awesomefont, fill="white")

					draw.text((2,-6),time.strftime("%X"), font=font_32,fill="white")

					draw.text((19, 48), vol_val, font=font_time, fill="white")
					draw.text((2, 51), text="\uf028", font=awesomefont, fill="white")
				screen_sleep = screen_sleep + 1
			#Screen saver
			else :
				with canvas(device) as draw:
					screensave += 2
					if screensave > 120 : 
						screensave = 3
					draw.text((screensave, 45), ".", font=font_time, fill="white")
				time.sleep(1)							
			time.sleep(0.1)
except :
    exc_type, exc_obj, exc_tb = sys.exc_info()
    fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
    print(exc_type, fname, exc_tb.tb_lineno)



