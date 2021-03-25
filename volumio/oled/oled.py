import apdisplaylib
import display
import evo_pages as pages
import json
import urllib.request as url 
import socket
import time
import os
import signal
import subprocess

# ----------------------------------
def main():

    # Create page manager
    page_manager = display.page_manager(pages,display)
    
    #  --------------------------------------------------
    #  |                DATA GATHERING                  |
    #  --------------------------------------------------
    #
    #   Define here all the methods required for gathering data 
    #   that has to be processed for display.  The whole operation
    #   is asynchronous and uses apdisplaylib.event_emitter 
    #   abstraction to deal with async events and multiple entry points.
    
    # Listen to socket input, create an event emitter, 
    # route socket outupt to event emitter. 
    # Expects incomming messages to be structured in JSON 
    uds_receiver = apdisplaylib.uds_input('./input_for_display',1024 )    
    uds_receiver.onmessage = uds_receiver.events.json_to_events  
    
    #mpd_listener = apdisplaylib.mpd_socket_client(  8192   )   
    #mpd_status = apdisplaylib.change_monitor(mpd_listener.get,0.5,verbose=True)
    
    # Listen to playback api ( make api call every 0.5 sec ),
    # route playback api changes to attached event emitter
    player_status = apdisplaylib.change_monitor(monitor_volumio_api,0.5)
    
    # Listen to DAC api ( make api call every 0.5 sec ),
    # route playback api changes to attached event emitter  
    dac_status = apdisplaylib.change_monitor(monitor_dac_status,0.5)

    # Listen to ipv4 changes ( read network status every 0.5 sec ),
    # route ipv4 changes to attached event emitter
    network_status = apdisplaylib.change_monitor(monitor_ipv4,0.5)
    
    # attach inputs (events emitters) defined before to page_manager
    # so pages can access data and react to specific events  
    page_manager.set_event_scope(
        socket_control = uds_receiver.events,
        player_status = player_status.events,
        network_status = network_status.events
        #mpd_status = mpd_status.events
    )    

    # Sleep to let the events emitter load defaults configs
    page_manager.display_page("logo_page")
    time.sleep(6)
    
    #  --------------------------------------------------
    #  |            LOW LEVEL DATA HANDLING             |
    #  --------------------------------------------------
    #  Rules that will be applied regardless of what the display
    #  is currently doing (highest priority). It should be prefered 
    #  for intuitive user experience with simple, easily-predictable
    #  interfaces.
    #
    #  On the other hand, don't overuse low level data handling rules
    #  if the app has many pages with complex navigation pathes. 
    #  Breaking the user flow gets less and less enviable as the app 
    #  grows in complexity.
    
    
    
    
    # Create instances of events emitters for low level handling logic
    socket_input_control   = uds_receiver.events.instance()
    api_monitor_control    = player_status.events.instance()
    network_status_control = network_status.events.instance()
    dac_status_control     = dac_status.events.instance()
    #mpd_status_control     = mpd_status.events.instance()

    
    
    # Read dac inputs 
    dac_status.data["dac_input"] = ""
    def manage_input(*args):
        iddle_monitor.reset()
        if args[0] == "SPDIF":
            page_manager.pages.default_page = page_manager.pages.SPDIF_page
            page_manager.display_default_page()  
        else : 
            page_manager.pages.default_page = page_manager.pages.clock_page
            page_manager.display_page("playback_page")
          
    dac_status_control.addEventListener("dac_input", manage_input)     
    socket_input_control.addEventListener("contrast", page_manager.display._change_base_contrast)
    socket_input_control.addEventListener("off", lambda *a : display.device.hide() )
    socket_input_control.addEventListener("on", lambda *a : display.device.show() )
    
    # allow process to kill itself with sigint which will be catched by the driver to properly shut down the display before exit
    def exit_cmd(*args):
        os.kill(os.getpid(), signal.SIGINT)
    socket_input_control.addEventListener("restart", exit_cmd )
    
    iddle_monitor = apdisplaylib.iddle_monitor(1)
    iddle_monitor.iddle = True
    
    def enter_deep_sleep_mode(*args):
        page_manager.unload_current_page()
        display.device.hide()
        
    def exit_iddle_mode(*args):
        if iddle_monitor.iddle:
            page_manager.display_default_page() # return to default page
        iddle_monitor.reset()
        display.device.show() 

    def dim(*args):
        page_manager.display.change_brightness(page_manager.display.base_contrast/2) 
        return True

    def display_clock(*args):
        page_manager.display_default_page()
        
    def display_screen_saver(*args):
        #if mpd_status_control.data.get("state") != "play" :
        if api_monitor_control.data.get("player_status") != "play" :
            page_manager.display_page("screen_saver")
            return True
    
    with open('config.json') as json_file:
        config = json.load(json_file)
        iddle_monitor.addTimeListener(15, display_clock ) 
        iddle_monitor.addTimeListener(config["dim_after"],dim)
        iddle_monitor.addTimeListener(config["sleep_after"], display_screen_saver  )
        iddle_monitor.addTimeListener(config["deep_sleep_after"], enter_deep_sleep_mode )        
        
    # what are the events that will prevent /  stop iddle mode and return to playback page
    api_monitor_control.addEventListeners(
        [   "track_position", 
            "player_status",
            "volume",
            "repeat",
            "repeatonce",
            "shuffle"
        ],
        exit_iddle_mode 
    )
    
    '''
    mpd_status_control.addEventListeners(
        [   "elapsed", 
            "state",
            "volume",
            "repeat",
            "single",
            "random"
        ],
        exit_iddle_mode 
    )    
    '''
    network_status_control.addEventListener("ip", iddle_monitor.reset )
    
    #  --------------------------------------------------
    #  |           HIGH LEVEL DATA HANDLING             |
    #  --------------------------------------------------
    #  Automatic set of rules that will define display behaviour    
    #  when specific events happen on certain pages.
    #  All logic is contained in pages variable imported at the very 
    #  beginning of this current script.
    
    # Start displaying data
    # This is the first page that should appear after the logo screen
    page_manager.display_default_page()

# ----------------------------------
# method to retrieve volumio status through API call
playback_dict = {
	"status"		: "player_status",
	"title"		    : "track_name",
	"album"		    : "album_name",
	"artist"		: "artist_name",
	"duration"	    : "track_duration",
	"seek"		    : "track_position",
	"bitrate"	    : "track_bitrate",
	"samplerate"	: "track_samplerate",
	"volume"		: "volume",
	"random"		: "shuffle",
	"repeatSingle"	: "repeatonce",
	"repeat"		: "repeat"
}

def map_playback_keys(keys,dict):   
	for l in list(keys):
		data = map_playback_key(l,dict)
		if(data):
			keys[data] = keys.pop(l)
	return keys

def map_playback_key(key,dict):
	if(key in dict):
		return dict[key]
	else:
		return False

def monitor_volumio_api():
    try:
        data = json.load(url.urlopen('http://127.0.0.1:3000/api/v1/getstate')) 
    except:
        data = {}
    return(map_playback_keys(data,playback_dict) ) 

def monitor_dac_status():
    data = {}
    try:
        pr = subprocess.run([ "apessq2m", "get_input" ], stdout=subprocess.PIPE)
        if (pr.stdout ==  b"'SPDIF'\n"):
            data["dac_input"] = "SPDIF"
        elif (pr.stdout ==  b"'I2S'\n"):
            data["dac_input"] = "Rasperry Pi"
    except:
        pass  
    return(data) 
    

    

# ---------------------------------- 
# method to retrieve ipv4
def monitor_ipv4():
    ip = False
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(("223.5.5.5",53))
        ip = s.getsockname()[0]
        s.close()
    except :
        pass
    return {"ip" : ip}

    
# ----------------------------------
main()