import socket
import os
import threading
import json 
import time 

# unix domain socket async server 
# reads data from multiple clients on socket path defined in server_address
class uds_input:
    def __init__(self, server_address,buffer_size):
        self.server_address = server_address
        self.events = event_emitter()
        self.buffer_size = buffer_size
        
        
        try:
            os.unlink(server_address)
        except OSError:
            if os.path.exists(server_address):
                raise      
        self.onmessage = False    
        self.thread = threading.Thread(target=self.start)
        self.thread.start()
        
    def handle_client(self,connection,client_address):
        while True:
            data = connection.recv(self.buffer_size).decode('utf-8')
            if data:
                # fire event hook 
                if callable(getattr(self,"onmessage", None)):
                    self.onmessage(data)
            else:
                break
        connection.close()

    def start(self):
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.bind(self.server_address)
        sock.listen(1)   
        while True:
            connection, client_address = sock.accept()
            thread = threading.Thread(target=self.handle_client,args=(connection,client_address),daemon=True)
            thread.start()
        sock.close()

class mpd_socket_client:
    def __init__(self,buffer_size):
        self.onmessage = False    
        self.buffer_size = buffer_size
        self.soc = False
        self.connect()
        
    def connect(self):    
        self.soc = False
        HOST		= '127.0.0.1'
        PORT		= 6600
        soc = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        soc.connect(   (HOST, PORT)     )
        self.soc = soc      
        self.get_data("")

    def get_data(self,target):
        if (self.soc):
            self.soc.send( str(target).encode() )
            result = self.soc.recv(self.buffer_size).decode()
            return result.splitlines()
        else: return {}
        
    def get(self):
        result = {}
        mpd_currentsong = self.get_data('currentsong\n')
        mpd_currentsong.pop()
        mpd_status = self.get_data('status\n')
        mpd_status.pop()

        for i in mpd_currentsong:
            split = i.split(":",1);
            result[split[0]] = split[1]
            
        for i in mpd_status:
            split = i.split(":",1);
            if(split[1][0] == " "):split[1] = split[1][1:] 
            result[split[0]] = split[1]
            
        #print(result)
        return(result)
   
        
class iddle_monitor:

    def __init__(self, sleep):    
        self.sleep = sleep
        self.iddle_time = 0
        self.iddle_events = []
        self.thread = threading.Thread(target=self.start)
        self.thread.start()
        self.iddle = False
        
    def start(self):
        while True:
            for i in self.iddle_events:
                i.check(self.iddle_time)
                
            self.iddle_time += self.sleep
            time.sleep(self.sleep)

    def addTimeListener(self,time,fn):
        time = int(time)
        if time > 0 :
            self.iddle_event(self,time,fn)

    def reset(self,*args):
        self.iddle = False
        self.iddle_time = 0
        for i in self.iddle_events:
            i.consumed = False
        
    # iddle_event :
    #
    # Object that stores a function and a target time 
    # Use check with current time as parameter and
    # the iddle_event object will call its function
    # Pass parameter parent : parent object (iddle_monitor that holds the event emitter )
    # Pass parameter time : when fn should fire
    # Pass parameter fn :  what should happen
    
    class iddle_event:
        def __init__(self, parent, time, fn):
            self.time = time
            self.fn = fn
            self.parent = parent
            self.parent.iddle_events.append(self)     
            self.consumed = False
            
        def check(self,current_time):
            if(current_time >= self.time and self.consumed == False ):

                result = self.fn()
                if result :
                    self.parent.iddle = True
                    self.consumed = True                    
                else : self.parent.reset()
                
        
# Api monitor :
#
# Instead of having a single main loop for executing a sequence of checks,
# each check is its own custom loop running at its own frequency. 
# Pass parameter fn : custom loop logic and data to be returned after check (dict).
# Pass parameter sleep : how long will the loop sleep between two checks.
#
# Emits event for each value change (e.g. if property "artist_name" has changed,
# event will have "artist_name" as event name and the new value for "artist_name"
# as parameter 
class change_monitor:
    def __init__(self, fn, sleep, **kwargs):    
        self.sleep = sleep
        self.fn = fn
        self.events = event_emitter()
        self.events.get_data = self.get_data
        self.onchange = False 
        self.data = {}        
        self.thread = threading.Thread(target=self.start)
        self.thread.start()
        self.verbose = kwargs.get("verbose",False)
        self.dict_override = kwargs.get("dict_override",False)
        if self.verbose : print("Listenning to events")
    def start(self):
        while True:
            #try:
            destroyed_items = []
            new_data = self.fn()
            if self.dict_override:
                new_data = map_playback_keys(new_data, self.dict_override)
            
            # Check for keys that have been previously registered 
            # and set their value to None if they are not there anymore
            for i in self.data:
                if self.data[i] and i not in new_data.keys():
                    self.data[i] = None
                  
            # Update and register key and their values         
            for i in new_data:
                # if key i is already registerd
                if i in self.data :
                    # check if value has changed 
                    if new_data[i] != self.data[i]:
                         # if so update value
                        self.data[i] = new_data[i]
                        # fire event hook 
                        if self.verbose : print("Event : ",i,self.data[i])
                        self.events.emit(i,self.data[i])
                # otherwise if key i is not registerd   
                else  :
                    # register key i
                    self.data[i] = new_data[i]
                    # fire event hook 
                    if self.verbose : print("Event : ",i,self.data[i])
                    self.events.emit(i,self.data[i])
                    
            #except: pass
            time.sleep(self.sleep)	         

    def get_data(self):
        return self.data
   
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





   
# Tiny event emitter with instantiation :
#
# Abstraction for async event propagating.
# 
# Use : create instance of event_emitter. An instance is a tool to bind
# a set of event listeners to a specific scope. It provide a method 
# to enclose a set of event rules into a single object so we can
# easily discard and revoke them all when their common purpose has
# been fulfilled. Use them to have pages listening to some events 
# without worrying of deleting each declared event rule. Even pages events
# use this same intantiation system, allowing dynamic objects to come and
# go.
# 
#   instance = event_emitter.instance
#
# Attach a listener to event_emiter instance : 
#    instance.addEventListener("test",myFunction) 
#       =>  event_emitter.emit("test",1,2)
#       =>  will run myFunction(1,2) parameters passed as *args

class event_emitter:
    def __init__(self):
        self.eventlisteners = {}
        self._instances = []
    def emit(self,event_name,*args):
        #print("event : ", event_name,*args)
        for i in self._instances:
            i._emit(event_name,*args)
        
    def instance(self):
        inst = event_emitter_instance(self)
        self._instances.append(inst)
        return (inst)
    
    def json_to_events(self,data):
        # test if valid json, return if not    
        try:                                                
            parsed_data = json.loads(data)
        except:
            return
        for i in parsed_data:
            # force value to be encapsuled in a list
            # (allows handling of events with n number of arguments)            
            if not isinstance(parsed_data[i], list):       
                parsed_data[i] = [parsed_data[i]]               
            self.emit(i, *parsed_data[i])   
            
    def get_data(self):
        return {}

class event_emitter_instance:
    def __init__(self, parent):
        self.eventlisteners = {}
        self._parent = parent 
        self.muted = False
        
    def mute(self):
        self.muted = True
        
    def unmute(self):
        self.muted = False
        
    @property    
    def data(self):
        return self._parent.get_data()
        
    def remove(self,*args):
        self.eventlisteners = {}
        self._parent._instances.remove(self)
        
    def _emit(self,event_name,*args):
        if self.muted : return
        if event_name in self.eventlisteners:
            for i in self.eventlisteners[event_name]:
                i(*args)
        
    # Register new event listener (function that will run when attached event is emitted).
    # If event name is alreay registered, attach function to this event name.
    # Otherwise, register event name and attach function
    def addEventListener(self,event_name, fn):
        if event_name in self.eventlisteners:
            self.eventlisteners[event_name].append(fn)
        else:
            self.eventlisteners[event_name] = [fn]
            
    def addEventListeners(self,event_names, fn):
        for i in event_names:
            self.addEventListener(i, fn)
           
            
    # Remove event listener from eventlisteners list.
    # Check if event is registered and if it contains function.
    # If so remove function from event listener
    def removeEventListener(self,event_name, fn):
        while event_name in self.eventlisteners and fn in self.eventlisteners[event_name]:
            self.eventlisteners[event_name].remove(fn)      

    # Register new event listener that will run only once.  
    # Wrap function in another function that removes itself from listeners list 
    # and call original function.
    #
    # Wrapped function is registered as event listener instead of original fn
    def addEventListenerOnce(self,event_name, fn):          
        def wrapped_fn(*args):      
            self.removeEventListener(event_name,wrapped_fn) 
            fn(*args)                                       
        self.addEventListener(event_name, wrapped_fn)
        
        