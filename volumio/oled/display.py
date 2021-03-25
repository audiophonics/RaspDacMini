#!/usr/bin/env python

import time
import threading
import json
import atexit
import apdisplaylib
from PIL import ImageFont
from luma.core.interface.serial import spi
from luma.core.render import canvas
from luma.oled.device import ssd1306
   
# ---------------------------------
# Default initial configuration
   
base_contrast = 50 



with open('config.json') as json_file:
    data = json.load(json_file)
    base_contrast = int(data["contrast"])
        
serial = spi(port=0, device=0, gpio_DC=27, gpio_RST=24)
device = ssd1306(serial, rotate=2, mode="1", framebuffer="diff_to_previous")

device.contrast(base_contrast)


oled_width	= 128
oled_height	= 64
font_folder_path = "fonts"
font_title       =  ImageFont.truetype(font_folder_path+"/msyh.ttf", 18)
font_big  =  ImageFont.truetype(font_folder_path+"/msyh.ttf", 30)
font_time        =  ImageFont.truetype(font_folder_path+"/msyh.ttf", 13)
font_awesome     =  ImageFont.truetype(font_folder_path+"/fontawesome-webfont.ttf", 12)
font_icons       =  ImageFont.truetype(font_folder_path+"/icons.ttf", 12)
font_big_icons   =  ImageFont.truetype(font_folder_path+"/icons.ttf", 30)
font_32   =  ImageFont.truetype(font_folder_path+"/arial.ttf", 30)
font_55  =  ImageFont.truetype(font_folder_path+"/arial.ttf", 30)


# ----------------------------------
# cleanup function to turn off display

@atexit.register
def cleanup():
    device.clear()
    device.hide()

# ----------------------------------
# classes definitions : pages handler

class page_manager:
    def __init__(self,pages,display):
        pages.page_manager = self
        pages.display = display
        self.pages = pages
        self.current_page = None
        self.event_scope = {}
        self.display = self.display_handle(device)
    
    class display_handle:
        def __init__(self,device):
            self.device = device
            self.current_contrast = base_contrast
            self.base_contrast = base_contrast
    
        def change_brightness(self,newval):
            newval = int(newval)
            if newval < 255 and newval > 0:
                try : 
                    self.device.contrast(newval)
                    self.current_contrast = newval
                except : pass  
                
        def _change_base_contrast(self,newval):
            newval = int(newval)
            if newval < 255 and newval > 0:
                try : 
                    self.device.contrast(newval)
                    self.base_contrast = newval
                except : pass
  
    def display_default_page(self):
        self.pages.default_page()
    
    def display_page(self,_target_page):
        page_function = getattr(self.pages, _target_page)
        if(page_function):
            page_function()
        else: raise ("Page " + _target_page + " do not exist")

    def load_page(self, newpage):
        self.unload_current_page()
        self.current_page = newpage
        if( not hasattr(newpage, 'no_contrast_reload') ):
            self.display.change_brightness(self.display.base_contrast)
        newpage._events.emit("load",newpage)

    def unload_current_page(self):
        if self.current_page :
            self.current_page.close() 
            self.current_page = None 
        
    # Every object passed in this data structure must be instantiable
    def set_event_scope(self, **kwargs):
        self.event_scope = {}
        for i in kwargs.keys():
             self.event_scope[i] = kwargs[i]

    def create_page(self):
        page = _page()
        instantiated_event_scope = {}
        for i in self.event_scope.keys():
            instantiated_event_scope[i] = self.event_scope[i].instance()  
        page.event_scope = instantiated_event_scope
        page._mute_event_scope()
        page.events.addEventListener("load",page._unmute_event_scope)
        return page
    
class _page:
    def __init__(self):
        self.refresh_delay = 1
        self.items = []
        self.running = False
        self._thread = None
        self._events = apdisplaylib.event_emitter()
        self.events = self._events.instance()
        self.event_scope = {}
        self.animation_frame = 0
        
        
        # About event_scope ( set in page_manager.create_page() function )
        #
        # Let's say we have a "next_page" event that triggered the creation of this page. 
        # If this page needs to listen to a "next_page" event as well, there is a problem :
        # The first "next_page" event is still resolving. That is because the initialization 
        # of this page is itself a response to this initial "next_page" event.
        # So this new listener would be pushed at the end of the (old) still-resolving stack.
        # The same single "next_page" event would then both create this page and immediately 
        # trigger whatever this page was supposed to do in response to another hypothetical future 
        # "next_page" event.         
        #
        # To solve this issue, every created page receives an event scope, which is basically
        # a group of instances of each event emitters the page can listen to. 
        # It allows to wipe clean all event listeners registered during page initialization
        # It also enables the system to mute all previous listeners whenever a new page is created
        # This way we can write logic without having to worry about removing / stopping any
        # previously defined event listeners that would cause bugs & crashes if not cleaned.
        #
        # In short, it ensures that the previous event stack cannot affect this page initialization.
        
    def _mute_event_scope(self,*args):
        for i in self.event_scope:
            self.event_scope[i].mute()
        
    def _unmute_event_scope(self,*args):
        for i in self.event_scope:
            self.event_scope[i].unmute()        
    
    def _clear_event_scope(self,*args):
        for i in self.event_scope:
            self.event_scope[i].remove()
  
    def add_item(self,item):
        self.items.append(item)
        item.page = self
        if getattr(item, "frame_cycle", False):
            self.events.addEventListener("draw",item.frame_cycle)
        return item
    
    def start(self,*args):
        #print ("starting page",self)
        if self.running : return
        self.running = True
        self._thread = threading.Thread(target=self.draw_fn)
        self._thread.start()
        
    
    def show(self,*args):  
        device.clear()
        with canvas(device) as draw:  
            for i in self.items:
                i.print_to_display(draw)       
        
    def close(self,*args):
        self._mute_event_scope()
        self._clear_event_scope() 
        if not self.running : return
        # Flag as not running. Will end draw_fn thread
        self.running = False
        
    def draw_fn(self,*args):
        self._events.emit("start", self)
        device.clear()
        while True:  
            if not self.running : 
                return
            with canvas(device) as draw:    
                for i in self.items:
                    i.print_to_display(draw)
            
            self._events.emit("draw", self.animation_frame)
            self.animation_frame += 1
            time.sleep(self.refresh_delay) 
        return            

# ----------------------------------
# classes definitions : dynamic objects handler (page building blocks)
class square:
    def __init__(self, x, y, length):
        self.x = x
        self.y = y
        self.length = length
        self.fill = 1
        
    def print_to_display(self, draw):
        i = 0 
        while i < self.length ** 2:
            draw.point( (self.x + ( i % self.length ) , self.y + ( i // self.length ) ) ,  fill = self.fill) 
            i += 1
            
            
class horizontal_fillbar:
    def __init__(self, x, y, value, max):
        self._value = int(value)
        self.max = max
        self.x = x 
        self.y = y
        self.padding = 2
        self.width = oled_width - x-1 
        self.height = 5
        self._fill_width = 2
    
    def update_value(self,value):
        if(not value): value = 0
        self._value = int(value)
        if self._value == 0 or self.max == 0: self._fill_width = 0
        else: self._fill_width = self._value * ( (self.width - self.padding ) / self.max  )
        if self._fill_width < self.padding : self._fill_width = self.padding
        
    def print_to_display(self,draw):
        draw.rectangle( (self.x,self.y,self.x+self.width,self.y+self.height), outline=1, fill=0)
        if self._value > 0:
            draw.rectangle(
                (self.x + self.padding,
                self.y + self.padding,
                self._fill_width + self.x,
                self.height + self.y - self.padding),
                fill=1)       

class text_box_inline:
    def __init__(self, x, y, font):
        self.text = ""
        self.font = font
        self.x = x
        self.y = y
        self.fill = 1
        self.stroke = 0

    def update_text(self,text):
        self.text = text
        
    def print_to_display(self, draw):
        draw.text(
            (self.x, self.y),
            text = self.text,
            font = self.font,
            fill = self.fill)
        
class logo:
    def __init__(self):
        self.data = []
        try:
            f = open("logo.logo", "r")
            status = False
            for x in f:
                x = int(x)
                color = 0
                i = 0 
                status = not status # invert write on / write off ( lossless decompression of b&w logo file)
                if status:
                    color = 1
                while i < x:
                    self.data.append(color)
                    i+=1
        except:
            print("no logo file found!")

 
    def print_to_display(self, draw):
            step = 0
            for p in self.data:
                x = step % (oled_width)
                y = step // (oled_width) 
                if p >0:            
                    draw.point( (x,y),fill=1 )
                step += 1    

# sub item for text_autoscroll                
class scroller_node:
    def __init__(self, string, width, midpoint):
        self.string = string
        self.width = width    
        self.midpoint = midpoint    
        
class text_autoscroll:
    def __init__(self,y,font):
        self.index = 0
        self.x_scroll = 0
        self.y = y        
        self.font = font
        self.fit_screen = False
        self.strings = []
        self.page = None
        self.start_frame = 0
        self.frame_start_delay = 70

    @property    
    def text(self,text):
        self.update_text(text)
        
    def update_text(self,text ):
        self.fit_screen = False
        self.x_scroll = 0
        self.index = 0
        self.start_frame = self.page.animation_frame
        text = " " + text 
        predicted_width, char  = self.font.getsize(text)
        overflow = oled_width - predicted_width 
        if(overflow<0):
            text += " -"  
            strings = self.autocut_long_string(text)
            parsed_strings = []
            l = len(strings)
            i = 0
            y = 0
            z = 0
            for s in strings:
                y = (i+1)%l
                z = (i+2)%l
                remainder, cut_str = self.string_cutter(strings[y] +strings[z])
                joined_string = strings[i] + cut_str 
                width, char  = font_title.getsize(joined_string)  
                midpoint, char  = font_title.getsize(strings[i])  
                parsed_strings.append( scroller_node(joined_string, width, midpoint) )
                i+=1
        else:
            parsed_strings = [scroller_node(text , predicted_width , predicted_width )]
            self.fit_screen = True
            
        self.strings = parsed_strings

    def current_chunk(self):
        return(self.strings[self.index]) 
        
    def next_cycle(self):
        self.index = (self.index + 1)%len(self.strings)
        self.x_scroll = 0
        return(self.current_chunk())
        
    def frame_cycle(self,frame):
        if self.fit_screen == False and self.page.animation_frame > self.start_frame + self.frame_start_delay :
            self.x_scroll += 1
            if(self.strings[self.index].midpoint <= self.x_scroll):
                self.next_cycle()
    
    def x(self):
        return(0 - self.x_scroll )
    
    def autocut_long_string(self,remainder):
        result = []
        while( len(remainder) ):
            remainder, cut_str = self.string_cutter(remainder)
            result.append(cut_str)
        return result        
        
    def string_cutter(self,string):
        buildstr = ""
        for c in string:
            buildstr += c
            width, char = self.font.getsize(buildstr)
            if(width > (oled_width) ):
               break
        return(string[len(buildstr):], buildstr)      
    
    def print_to_display(self,draw):
        draw.text((self.x(), self.y),self.current_chunk().string , font=self.font, fill=1)
    
        
        
# ----------------------------------

def status_logo(status):
    status_icon = ""
    if status == "pause":
        status_icon = "\uf04c"
    elif status   == "stop":
        status_icon = "\uf04d"
    elif status  == "play":
        status_icon = "\uf04b"
    return status_icon
    
def format_ms_to_text(ms):
    s_min = ms // 60000
    s_sec = ms % 60000
    return ( str(s_min).zfill(2)+":"+str(s_sec)[:-3].zfill(2) )

def concat_force_separator(strings):
    while None in strings:
        strings.remove(None)       
    return " - ".join(strings)   
    
# ----------------------------------

