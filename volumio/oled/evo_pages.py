import time
from random import randrange
display = None
page_manager = None

def clock_page():
    page = page_manager.create_page()
    page.refresh_delay = 0.5
    page.no_contrast_reload = True
    
    # To display this page we need data from player and from network
    player_status = page.event_scope["player_status"] 
    network_status = page.event_scope["network_status"]
    
    # Build the page 
    def init(*args): 
        # ------ 
        # Time object    
        time_clock = page.add_item(
            display.text_box_inline(
                randrange(10) - 5,
                -2,
                display.font_55
            )
        )   
     
        # ------ 
        # Ip Address object
        network_ip_text = page.add_item(
            display.text_box_inline(
                23 +  randrange(10) - 5,
                43,
                display.font_time
            )
        )
        
        def update_clock(*args):
            t = time.localtime()
            time_clock.text = time.strftime("%X", t)
            
            if(args and args[0] and args[0] % 20 == 0):
                time_clock.x = randrange(10) - 5
                network_ip_text.x = (23 + randrange(10) - 5)
            
        update_clock()
        page.events.addEventListener("draw", update_clock )     
        
        def update_network_ip(*args):
            network_ip = network_status.data.get("ip",False)
            if network_ip :
                network_ip_text.text = network_ip
            else :
                network_ip_text.text = "Not connected"
                
        update_network_ip()        
        network_status.addEventListener("ip",update_network_ip)
        
        # Tell clock page that any change in playback status or seek should cause the display to print playback page instead
        def return_to_playback(*a):
            print("clock bounce")
            page_manager.display_page("playback_page")
        player_status.addEventListeners(["player_status","seek" ],return_to_playback)

        page.start()
        
    # load page in page manager and start displaying it when loaded
    page.events.addEventListener("load", init ) 
    page_manager.load_page(page)
    
def screen_saver():

    # Create page, define refresh delay
    page = page_manager.create_page()
    page.refresh_delay = 0.04
    start_contrast = page_manager.display.current_contrast
    end_contrast = 0
    # Build the page 
    def init(*args): 
        square = page.add_item(
            display.square(0,0,3)
        )     
        
        def move_square(*args):
            counter = ( page.animation_frame * square.length  ) % ( (display.oled_width *  display.oled_height)   ) 
            square.x = ( counter ) % display.oled_width
            square.y = ( (  (counter ) // (display.oled_width)  ) * square.length ) % display.oled_height
            fade_out_frames = display.oled_width // square.length
            
            if page_manager.display.current_contrast >= end_contrast :
                fade_out = int( start_contrast - 1 / fade_out_frames * page.animation_frame * ( start_contrast - end_contrast) )
                page_manager.display.change_brightness(fade_out)
                
        page.events.addEventListener("draw", move_square)
        page.start()
        
    # load page in page manager and start displaying it when loaded
    page.events.addEventListener("load", init ) 
    page_manager.load_page(page)
    
def playback_page():

    # Create page, define refresh delay
    page = page_manager.create_page()
    page.refresh_delay = 0.04
    
    # To display this page we need data from player and from network
    player_status = page.event_scope["player_status"]
    network_status = page.event_scope["network_status"]

    # Build the page 
    def init(*args): 
  
        # ------ 
        # Item : scrolling text with title, album and artist name 
        title_artist_album = page.add_item( display.text_autoscroll( -4, display.font_title ) )   
        
        # How this item should be set and updated : display current title, artist ,album name
        def update_title_artist_album(*args):
            text = display.concat_force_separator(
                [
                    player_status.data.get("track_name"),
                    player_status.data.get("artist_name"),
                    player_status.data.get("album_name")
                ])  
            title_artist_album.update_text(text)
        
        # Item should be updated (recomputed) in response to a change of title, artist or album        
        update_title_artist_album()
        player_status.addEventListeners(["track_name","artist_name","album_name"], update_title_artist_album )  
       
       
        # ------ 
        # Play / Pause / Stop Logo     
        playback_status_logo = page.add_item(
            display.text_box_inline(
                5,
                42,
                display.font_awesome
            )
        )

        def update_playback_status_logo(*args):
            status_logo = display.status_logo(player_status.data.get("player_status") )
            playback_status_logo.update_text(status_logo)

        update_playback_status_logo()
        player_status.addEventListener("player_status", update_playback_status_logo )  
        
        
        # ------ 
        # Seek bar & seek text
        seek_bar = page.add_item( 
            display.horizontal_fillbar(  5,  58, 0, 0 ) 
        )
        seek_text = page.add_item(
            display.text_box_inline(
                19,
                40,
                display.font_time
            )
        )
        
        def update_seek(*args):
            try:
                track_pos_as_text = display.format_ms_to_text(int( player_status.data.get("track_position",0) )     )
                seek_bar.max = player_status.data.get("track_duration",0)*1000
                seek_bar.update_value(player_status.data.get("track_position",0))
            except :
                track_pos_as_text = "--:--"
                seek_bar.max = 0
                seek_bar.update_value(player_status.data.get("track_position",0))
            try:
                track_dur_as_text = display.format_ms_to_text(int( player_status.data.get("track_duration",0) )*1000)
            except :
                track_dur_as_text = "--:--"
            seek_text.update_text(  track_pos_as_text  + " / " + track_dur_as_text)
            
        update_seek()
        player_status.addEventListeners(["track_position","track_duration"],update_seek )
        
        # ------ 
        # Repeat logo   
        repeat_logo = page.add_item(
            display.text_box_inline(
                112,
                45,
                display.font_icons
            )
        )
        
        def update_repeat_logo(*args):
            repeat_mode = player_status.data.get("repeat",False)
            repeat_once = player_status.data.get("repeatonce",False)
            if repeat_mode and repeat_once:
                repeat_logo.text = "\uea2d"
            elif repeat_mode :
                repeat_logo.text = "\uea2e"
            else :
                repeat_logo.text = ""
                
        update_repeat_logo()        
        player_status.addEventListeners(["repeat","repeatonce"],update_repeat_logo)
        # ------ 
        # Volume logo + value in digit
        volume_logo = page.add_item(
            display.text_box_inline(
                5,
                24,
                display.font_icons
            )
        )
        
        volume_text = page.add_item(
            display.text_box_inline(
                20,
                22,
                display.font_time
            )
        )
        volume_text.update_text(str(player_status.data.get("volume","--")))

        def update_volume_value_logo(*args):
            # get current volume value
            try: 
                volume_value = int( player_status.data.get("volume",0) )
            except:
                volume_value = 0
            volume_as_string = str(player_status.data.get("volume","--"))
            
            volume_text.update_text( volume_as_string )
            
            # Change volume logo according to volume value
            if player_status.data.get("mute", False):
               volume_logo.text = "\uea2a" 
            elif volume_value > 66:
                volume_logo.text = "\uea26"
            elif volume_value > 33 : 
                volume_logo.text = "\uea27"
            elif volume_value > 0 :
                volume_logo.text = "\uea28"
            else :    
                volume_logo.text = "\uea29"
            
        update_volume_value_logo()             
        player_status.addEventListeners(["volume","mute"],update_volume_value_logo )  
        
         
        # ------ 
        # samplingfreq
        sampling_text = page.add_item(
            display.text_box_inline(
                40,
                22,
                display.font_time
            )
        )
        def update_sampling(*args):
            # get current sampling rate value
            sample_as_string = str(player_status.data.get("track_samplerate","") or "")
            if (not sample_as_string):
                # if sampling rate is not available, try bitrate instead
                sample_as_string = str(player_status.data.get("track_bitrate","") or "")
            if (sample_as_string):
                sample_as_string = " | " + sample_as_string
            else : sample_as_string = ""
            sampling_text.update_text( sample_as_string )
        update_sampling()    
        player_status.addEventListeners(["track_samplerate"],update_sampling )  
        
        page.start()

    # load page in page manager and start displaying it when loaded
    page.events.addEventListener("load", init ) 
    page_manager.load_page(page)
    
def logo_page():

    # Create page, define refresh delay
    page = page_manager.create_page()
    page.refresh_delay = 5
    
    socket_control = page.event_scope["socket_control"]
    socket_control.addEventListener("next",lambda *a : page_manager.display_page("playback_page"))     
    # Declare what happens when the screen is ready to display this page
    def init(*args): 
        logo = page.add_item(
            display.logo()
        )          
        page.show()
        
    # load page in page manager and start displaying it when loaded
    page.events.addEventListener("load", init ) 
    page_manager.load_page(page)
        
def SPDIF_page():
    page = page_manager.create_page()
    page.refresh_delay = 0.5
    page.no_contrast_reload = True
    
    # Build the page 
    def init(*args): 
        # ------ 
        # text object    
        SPDIF_text = page.add_item(
            display.text_box_inline(
                randrange(44),
                randrange(30),
                display.font_55
            )
        )   
     
        def display_item(*args):
            t = time.localtime()
            SPDIF_text.text = "SPDIF"
            
            if(args and args[0] and args[0] % 10 == 0):
                SPDIF_text.x = randrange(44)
                SPDIF_text.y = randrange(30)
            
        display_item()
        page.events.addEventListener("draw", display_item )     
        page.start()
        

    # load page in page manager and start displaying it when loaded
    page.events.addEventListener("load", init ) 
    page_manager.load_page(page)
    
    
default_page = clock_page