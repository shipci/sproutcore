// ==========================================================================
// Project:   SproutCore Costello - Property Observing Library
// Copyright: ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple, Inc. All rights reserved.
// License:   Licened under MIT license (see license.js)
// ==========================================================================

require('private/observer_set') ;

/*globals logChange */

/**
  @namespace 
  
  Key-Value-Observing (KVO) simply allows one object to observe changes to a 
  property on another object. It is one of the fundamental ways that models, 
  controllers and views communicate with each other in a SproutCore 
  application.  Any object that has this module applied to it can be used in 
  KVO-operations.
  
  This module is applied automatically to all objects that inherit from
  SC.Object, which includes most objects bundled with the SproutCore 
  framework.  You will not generally apply this module to classes yourself,
  but you will use the features provided by this module frequently, so it is
  important to understand how to use it.
  
  h2. Enabling Key Value Observing

  With KVO, you can write functions that will be called automatically whenever 
  a property on a particular object changes.  You can use this feature to
  reduce the amount of "glue code" that you often write to tie the various 
  parts of your application together.
  
  To use KVO, just use the KVO-aware methods get() and set() to access 
  properties instead of accessing properties directly.  Instead of writing:
  
  {{{
    var aName = contact.firstName ;
    contact.firstName = 'Charles' ;
  }}}

  use:

  {{{
    var aName = contact.get('firstName') ;
    contact.set('firstName', 'Charles') ;
  }}}
  
  get() and set() work just like the normal "dot operators" provided by 
  JavaScript but they provide you with much more power, including not only
  observing but computed properties as well.

  h2. Observing Property Changes

  You typically observe property changes simply by adding the observes() 
  call to the end of your method declarations in classes that you write.  For
  example:
  
  {{{
    SC.Object.create({
      valueObserver: function() {
        // Executes whenever the "Value" property changes
      }.observes('value')
    }) ;
  }}}
  
  Although this is the most common way to add an observer, this capability is
  actually built into the SC.Object class on top of two methods defined in
  this mixin called addObserver() and removeObserver().  You can use these two
  methods to add and remove observers yourself if you need to do so at run 
  time.  
  
  To add an observer for a property, just call:
  
  {{{
    object.addObserver('propertyKey', targetObject, targetAction) ;
  }}}
  
  This will call the 'targetAction' method on the targetObject to be called
  whenever the value of the propertyKey changes.
  
  h2. Observer Parameters
  
  An observer function typically does not need to accept any parameters, 
  however you can accept certain arguments when writing generic observers. 
  An observer function can have the following arguments:
  
  {{{
    propertyObserver(target, key, value, revision) ;
  }}}
  
  - *target* - This is the object whose value changed.  Usually this.
  - *key* - The key of the value that changed
  - *value* - this property is no longer used.  It will always be null
  - *revision* - this is the revision of the target object
  
  h2. Implementing Manual Change Notifications
  
  Sometimes you may want to control the rate at which notifications for 
  a property are delivered, for example by checking first to make sure 
  that the value has changed.
  
  To do this, you need to implement a computed property for the property 
  you want to change and override automaticallyNotifiesObserversFor().
  
  The example below will only notify if the "balance" property value actually
  changes:
  
  {{{
    
    automaticallyNotifiesObserversFor: function(key) {
      return (key === 'balance') ? NO : sc_super() ;
    },
    
    balance: function(key, value) {
      var balance = this._balance ;
      if ((value !== undefined) && (balance !== value)) {
        this.propertyWillChange(key) ;
        balance = this._balance = value ;
        this.propertyDidChange(key) ;
      }
      return balance ;
    }
    
  }}}
  
  h1. Implementation Details
  
  Internally, SproutCore keeps track of observable information by adding a
  number of properties to the object adopting the observable.  All of these
  properties begin with "_kvo_" to separate them from the rest of your object.
  
  @static
  @since SproutCore 1.0
*/
SC.Observable = {

  /**
    Determines whether observers should be automatically notified of changes
    to a key.
    
    If you are manually implementing change notifications for a property, you
    can override this method to return NO for properties you do not want the
    observing system to automatically notify for.
    
    The default implementation always returns YES.
    
    @param key {String} the key that is changing
    @returns {Boolean} YES if automatic notification should occur.
  */
  automaticallyNotifiesObserversFor: function(key) { 
    return YES;
  },

  // ..........................................
  // PROPERTIES
  // 
  // Use these methods to get/set properties.  This will handle observing
  // notifications as well as allowing you to define functions that can be 
  // used as properties.

  /**  
    Retrieves the value of key from the object.
    
    This method is generally very similar to using object[key] or object.key,
    however it supports both computed properties and the unknownProperty
    handler.
    
    *Computed Properties*
    
    Computed properties are methods defined with the property() modifier
    declared at the end, such as:
    
    {{{
      fullName: function() {
        return this.getEach('firstName', 'lastName').compact().join(' ');
      }.property('firstName', 'lastName')
    }}}
    
    When you call get() on a computed property, the property function will be
    called and the return value will be returned instead of the function
    itself.
    
    *Unknown Properties*
    
    Likewise, if you try to call get() on a property whose values is
    undefined, the unknownProperty() method will be called on the object.
    If this method reutrns any value other than undefined, it will be returned
    instead.  This allows you to implement "virtual" properties that are 
    not defined upfront.
    
    @param key {String} the property to retrieve
    @returns {Object} the property value or undefined.
    
  */
  get: function(key) {
    var ret = this[key] ;
    if (ret === undefined) {
      return this.unknownProperty(key) ;
    } else if (ret && ret.isProperty) {
      if (ret.isCacheable) {
        return (this[ret.cacheKey] !== undefined) ? this[ret.cacheKey] : (this[ret.cacheKey] = ret.call(this,key)) ;
      } else return ret.call(this,key);
    } else return ret ;
  },

  /**  
    Sets the key equal to value.
    
    This method is generally very similar to calling object[key] = value or
    object.key = value, except that it provides support for computed 
    properties, the unknownProperty() method and property observers.
    
    *Computed Properties*
    
    If you try to set a value on a key that has a computed property handler
    defined (see the get() method for an example), then set() will call
    that method, passing both the value and key instead of simply changing 
    the value itself.  This is useful for those times when you need to 
    implement a property that is composed of one or more member
    properties.
    
    *Unknown Properties*
    
    If you try to set a value on a key that is undefined in the target 
    object, then the unknownProperty() handler will be called instead.  This
    gives you an opportunity to implement complex "virtual" properties that
    are not predefined on the obejct.  If unknownProperty() returns 
    undefined, then set() will simply set the value on the object.
    
    *Property Observers*
    
    In addition to changing the property, set() will also register a 
    property change with the object.  Unless you have placed this call 
    inside of a beginPropertyChanges() and endPropertyChanges(), any "local"
    observers (i.e. observer methods declared on the same object), will be
    called immediately.  Any "remote" observers (i.e. observer methods 
    declared on another object) will be placed in a queue and called at a
    later time in a coelesced manner.
    
    *Chaining*
    
    In addition to property changes, set() returns the value of the object
    itself so you can do chaining like this:
    
    {{{
      record.set('firstName', 'Charles').set('lastName', 'Jolley');
    }}}
    
    @param key {String} the property to set
    @param value {Object} the value to set or null.
    @returns {this}
  */
  set: function(key, value) {
    var func = this[key], ret = value, dependents ;
    
    var notify = this.automaticallyNotifiesObserversFor(key) ;
    
    // set the value.
    if (func && func.isProperty) {
      if (func.isVolatile || (this[func.lastSetValueKey] !== value)) {
        this[func.lastSetValueKey] = value ;
        if (notify) this.propertyWillChange(key) ;
        ret = func.call(this,key,value) ;

        // update cached value
        if (func.isCacheable) this[func.cacheKey] = ret ;

        if (notify) this.propertyDidChange(key, ret) ;
        
      }

    } else if (func === undefined) {
      if (notify) this.propertyWillChange(key) ;
      this.unknownProperty(key,value) ;
      if (notify) this.propertyDidChange(key, ret) ;

    } else {
      if (this[key] !== value) {
        if (notify) this.propertyWillChange(key) ;
        ret = this[key] = value ;
        if (notify) this.propertyDidChange(key, ret) ;
      }
    }
    
    // if there are any dependent keys and they use caching, then clear the
    // cache.
    if (dependents = this._kvo_cachedDependents) {
      dependents = this._kvo_cachedDependents[key] ;
      if (dependents && dependents.length > 0) {
        var idx = dependents.length;
        while(--idx>=0) {
          func = dependents[idx];
          this[func.cacheKey] = this[func.lastSetValueKey] = undefined;
        }
      }
    }
    
    return this ;
  },

  /**  
    Called whenever you try to get or set an undefined property.
    
    This is a generic property handler.  If you define it, it will be called
    when the named property is not yet set in the object.  The default does
    nothing.
    
    @param key {String} the key that was requested
    @param value {Object} The value if called as a setter, undefined if called as a getter.
    @returns {Object} The new value for key.
  */
  unknownProperty: function(key,value) {
    if (!(value === undefined)) { this[key] = value; }
    return value ;
  },

  /**  
    Begins a grouping of property changes.
    
    You can use this method to group property changes so that notifications
    will not be sent until the changes are finished.  If you plan to make a 
    large number of changes to an object at one time, you should call this 
    method at the beginning of the changes to suspend change notifications.
    When you are done making changes, all endPropertyChanges() to allow 
    notification to resume.
    
    @returns {this}
  */
  beginPropertyChanges: function() {
    this._kvo_changeLevel = (this._kvo_changeLevel || 0) + 1; 
    return this;
  },

  /**  
    Ends a grouping of property changes.
    
    You can use this method to group property changes so that notifications
    will not be sent until the changes are finished.  If you plan to make a 
    large number of changes to an object at one time, you should call 
    beginPropertyChanges() at the beginning of the changes to suspend change 
    notifications. When you are done making changes, call this method to allow 
    notification to resume.
    
    @returns {this}
  */
  endPropertyChanges: function() {
    this._kvo_changeLevel = (this._kvo_changeLevel || 1) - 1 ;
    var level = this._kvo_changeLevel;
    if ((level<=0) && this._kvo_changes && (this._kvo_changes.length>0)) {
      this._notifyPropertyObservers() ;
    } 
    return this ;
  },

  /**  
    Notify the observer system that a property is about to change.

    Sometimes you need to change a value directly or indirectly without 
    actually calling get() or set() on it.  In this case, you can use this 
    method and propertyDidChange() instead.  Calling these two methods 
    together will notify all observers that the property has potentially 
    changed value.
    
    Note that you must always call propertyWillChange and propertyDidChange as 
    a pair.  If you do not, it may get the property change groups out of order 
    and cause notifications to be delivered more often than you would like.
    
    @param key {String} The property key that is about to change.
    @returns {this}
  */
  propertyWillChange: function(key) {
    return this ;
  },

  /**  
    Notify the observer system that a property has just changed.

    Sometimes you need to change a value directly or indirectly without 
    actually calling get() or set() on it.  In this case, you can use this 
    method and propertyWillChange() instead.  Calling these two methods 
    together will notify all observers that the property has potentially 
    changed value.
    
    Note that you must always call propertyWillChange and propertyDidChange as 
    a pair. If you do not, it may get the property change groups out of order 
    and cause notifications to be delivered more often than you would like.
    
    @param key {String} The property key that has just changed.
    @param value {Object} The new value of the key.  May be null.
    @returns {this}
  */
  propertyDidChange: function(key,value) {

    this._kvo_revision = (this._kvo_revision || 0) + 1; 
    var level = this._kvo_changeLevel || 0 ;

    // clear any cached value
    var func = this[key] ;
    if (func && (func instanceof Function) && func.isCacheable) {
      this[func.cacheKey] = this[func.lastSetValueKey] = undefined ;
    }
    
    // save in the change set if queuing changes
    var suspended ;
    if ((level > 0) || (suspended=SC.Observers.isObserveringSuspended)) {
      var changes = this._kvo_changes ;
      if (!changes) changes = this._kvo_changes = SC.Set.create() ;
      changes.add(key) ;
      
      if (suspended) SC.Observers.objectHasPendingChanges(this) ;
      
    // otherwise notify property observers immediately
    } else this._notifyPropertyObservers(key) ;
    
    return this ;
  },

  // ..........................................
  // DEPENDENT KEYS
  // 

  /**
    Use this to indicate that one key changes if other keys it depends on 
    change.
    
    You generally do not call this method, but instead pass dependent keys to
    your property() method when you declare a computed property.
    
    You can call this method during your init to register the keys that should
    trigger a change notification for your computed properties.  
    
    @param key {String} the dependent key followed by any keys the key depends on.
    @returns {Object} this
  */  
  registerDependentKey: function(key) {
    var idx = arguments.length ;
    var dependents = this._kvo_dependents ;
    if (!dependents) this._kvo_dependents = dependents = {} ;

    // the cached dependents hash contains computed properties that are 
    // dependent and cached.  It is important not to define 
    // _kvo_cachedDependents until this feature is actually used for perf
    // reasons.
    var cached = this._kvo_cachedDependents ;
    var dep, func, array, arrayIdx, queue;
    
    // note that we store dependents as simple arrays instead of using set.
    // we assume that in general you won't call registerDependentKey() more
    // than once for a particular base key.  Even if you do, the added cost
    // of having dups is minor.
    
    // for each key, build array of dependents, add this key...
    // note that we ignore the first argument since it is the key...
    while(--idx >= 1) {
      dep = arguments[idx] ;
      
      // handle the case where the user passes arrays of keys...
      if (SC.typeOf(dep) === SC.T_ARRAY) {
        array = dep ;  arrayIdx = array.length;
        while(--arrayIdx >= 0) {
          dep = array[arrayIdx] ;
          
          // add to dependents
          queue = dependents[dep] ;
          if (!queue) queue = dependents[dep] = [] ;
          queue.push(key) ;

          // add function 
          func = this[key];
          if (func && (func instanceof Function) && func.isCacheable) {
            if (!cached) this._kvo_cachedDependents = cached = {};
            queue = cached[dep] ;
            if (!queue) queue = cached[dep] = [] ;
            queue.push(func) ;
          }
        }
        
      // otherwise, just add the key.
      } else {
        queue = dependents[dep] ;
        if (!queue) queue = dependents[dep] = [] ;
        queue.push(key) ;
          
        // add to cached dependents if needed
        func = this[key];
        if (func && (func instanceof Function) && func.isCacheable) {
          if (!cached) this._kvo_cachedDependents = cached = {};
          queue = cached[dep] ;
          if (!queue) queue = cached[dep] = [] ;
          queue.push(func) ;
        }
      }
    }
  },
  
  // ..........................................
  // OBSERVERS
  // 
  
  _kvo_for: function(kvoKey, type) {
    var ret = this[kvoKey] ;

    if (!this._kvo_cloned) this._kvo_cloned = {} ;
    
    // if the item does not exist, create it.  Unless type is passed, 
    // assume array.
    if (!ret) {
      ret = this[kvoKey] = (type === undefined) ? [] : type.create();
      this._kvo_cloned[kvoKey] = YES ;
      
    // if item does exist but has not been cloned, then clone it.  Note
    // that all types must implement slice().0
    } else if (!this._kvo_cloned[kvoKey]) {
      ret = this[kvoKey] = ret.slice();
      this._kvo_cloned[kvoKey] = YES; 
    }
    
    return ret ;
  },

  /**  
    Adds an observer on a property.
    
    This is the core method used to register an observer for a property.
    
    Once you call this method, anytime the key's value is set, your observer
    will be notified.  Note that the observers are triggered anytime the
    value is set, regardless of whether it has actually changed.  Your
    observer should be prepared to handle that.
    
    @param key {String} the key to observer
    @param target {Object} the target object to invoke
    @param method {String|Function} the method to invoke.
    @returns {SC.Object} self
  */
  addObserver: function(key,target,method) {
    
    var kvoKey, chain, chains, observers;
    
    // normalize.  if a function is passed to target, make it the method.
    if (method === undefined) {
      method = target; target = this ;
    }
    if (!target) target = this ;
    if (SC.typeOf(method) === SC.T_STRING) method = target[method] ;
    if (!method) throw "You must pass a method to addObserver()" ;

    // Normalize key...
    key = key.toString() ;
    if (key.indexOf('.') >= 0) {
      
      // create the chain and save it for later so we can tear it down if 
      // needed.
      chain = SC._ChainObserver.createChain(this, key, target, method);
      chain.masterTarget = target;  chain.masterMethod = method ;
      
      // Save in set for chain observers.
      this._kvo_for(SC.keyFor('_kvo_chains', key)).push(chain);
      
    // Create observers if needed...
    } else {
      
      // Special case to support reduced properties.  If the property 
      // key begins with '@' and its value is unknown, then try to get its
      // value.  This will configure the dependent keys if needed.
      if ((this[key] === undefined) && (key.indexOf('@') === 0)) {
        this.get(key) ;
      }

      if (target === this) target = null ; // use null for observers only.
      kvoKey = SC.keyFor('_kvo_observers', key);
      this._kvo_for(kvoKey, SC._ObserverSet).add(target, method);
      this._kvo_for('_kvo_observed_keys', SC.Set).add(key) ;
    }
    
    return this;
  },

  removeObserver: function(key, target, method) {
    
    var kvoKey, chains, chain, observers, idx ;
    
    // normalize.  if a function is passed to target, make it the method.
    if (method === undefined) {
      method = target; target = this ;
    }
    if (!target) target = this ;
    if (SC.typeOf(method) === SC.T_STRING) method = target[method] ;
    if (!method) throw "You must pass a method to addObserver()" ;

    // if the key contains a '.', this is a chained observer.
    key = key.toString() ;
    if (key.indexOf('.') >= 0) {
      
      // try to find matching chains
      kvoKey = SC.keyFor('_kvo_chains', key);
      if (chains = this[kvoKey]) {
        
        // if chains have not been cloned yet, do so now.
        chains = this._kvo_for(kvoKey) ;
        
        // remove any chains
        idx = chains.length;
        while(--idx >= 0) {
          chain = chains[idx];
          if (chain && (chain.masterTarget===target) && (chain.masterMethod===method)) {
            chains[idx] = chain.destroyChain() ;
          }
        }
      }
      
    // otherwise, just like a normal observer.
    } else {
      if (target === this) target = null ; // use null for observers only.
      kvoKey = SC.keyFor('_kvo_observers', key) ;
      if (observers = this[kvoKey]) {
        // if observers have not been cloned yet, do so now
        observers = this._kvo_for(kvoKey) ;
        observers.remove(target, method) ;
        if (observers.targets <= 0) {
          this._kvo_for('_kvo_observed_keys', SC.Set).remove(key);
        }
      }
    }
    
    return this;
  },
  

  /**
    This method will register any observers and computed properties saved on
    the object.  Normally you do not need to call this method youself.  It
    is invoked automatically just before property notifications are sent and
    from the init() method of SC.Object.  You may choose to call this
    from your own initialization method if you are using SC.Observable in
    a non-SC.Object-based object.
    
    This method looks for several private variables, which you can setup,
    to initialize:
    
      - _observers: this should contain an array of key names for observers
        you need to configure.
        
      - _bindings: this should contain an array of key names that configure
        bindings.
        
      - _properties: this should contain an array of key names for computed
        properties.
        
    @returns {Object} this
  */
  initObservable: function() {
    if (this._observableInited) return ;
    this._observableInited = YES ;
    
    var loc, keys, key, value, observer, propertyPaths, propertyPathsLength ;
    
    // Loop through observer functions and register them
    if (keys = this._observers) {
      var len = keys.length ;
      for(loc=0;loc<len;loc++) {
        key = keys[loc]; observer = this[key] ;
        propertyPaths = observer.propertyPaths ;
        propertyPathsLength = (propertyPaths) ? propertyPaths.length : 0 ;
        for(var ploc=0;ploc<propertyPathsLength;ploc++) {
          var path = propertyPaths[ploc] ;
          var dotIndex = path.indexOf('.') ;
          // handle most common case, observing a local property
          if (dotIndex < 0) {
            this.addObserver(path, this, observer) ;

          // next most common case, use a chained observer
          } else if (path.indexOf('*') === 0) {
            this.addObserver(path.slice(1), this, observer) ;
            
          // otherwise register the observer in the observers queue.  This 
          // will add the observer now or later when the named path becomes
          // available.
          } else {
            var root = null ;
            
            // handle special cases for observers that look to the local root
            if (dotIndex === 0) {
              root = this; path = path.slice(1) ;
            } else if (dotIndex===4 && path.slice(0,5) === 'this.') {
              root = this; path = path.slice(5) ;
            } else if (dotIndex<0 && path.length===4 && path === 'this') {
              root = this; path = '';
            }
            
            SC.Observers.addObserver(path, this, observer, root); 
          }
        }
      }
    }

    // Add Bindings
    this.bindings = []; // will be filled in by the bind() method.
    if (keys = this._bindings) {
      for(loc=0;loc<keys.length;loc++) {
        // get propertyKey
        key = keys[loc] ; value = this[key] ;
        var propertyKey = key.slice(0,-7) ; // contentBinding => content
        this[key] = this.bind(propertyKey, value) ;
      }
    }

    // Add Properties
    if (keys = this._properties) {
      for(loc=0;loc<keys.length;loc++) {
        key = keys[loc] ; value = this[key] ;
        if (value && value.dependentKeys && (value.dependentKeys.length>0)) {
          var args = value.dependentKeys.slice() ;
          args.unshift(key) ;
          this.registerDependentKey.apply(this,args) ;
        }
      }
    }
    
  },
  
  // ..........................................
  // NOTIFICATION
  // 

  /**
    Returns an array with all of the observers registered for the specified
    key.  This is intended for debugging purposes only.  You generally do not
    want to rely on this method for production code.
    
    @params key {String} the key to evaluate
    @returns {Array} array of Observer objects, describing the observer.
  */
  observersForKey: function(key) {
    var observers = this._kvo_for('_kvo_observers', key) ;
    return observers.getMembers() || [] ;
  },
  
  // this private method actually notifies the observers for any keys in the
  // observer queue.  If you pass a key it will be added to the queue.
  _notifyPropertyObservers: function(key) {

    if (!this._observableInited) this.initObservable() ;
    
    SC.Observers.flush() ; // hookup as many observers as possible.

    var observers, changes, dependents, starObservers, idx, keys, rev ;
    var members, membersLength, member, memberLoc, target, method, loc, func ;

    // Get any starObservers -- they will be notified of all changes.
    starObservers =  this['_kvo_observers_*'] ;
    
    // prevent notifications from being sent until complete
    this._kvo_changeLevel = (this._kvo_changeLevel || 0) + 1; 

    // keep sending notifications as long as there are changes
    while(((changes = this._kvo_changes) && (changes.length > 0)) || key) {
      
      // increment revision
      rev = this.propertyRevision++;
      
      // save the current set of changes and swap out the kvo_changes so that
      // any set() calls by observers will be saved in a new set.
      if (!changes) changes = SC.Set.create() ;
      this._kvo_changes = this._kvo_altChanges ;
      this._kvo_altChanges = null ; 

      // Add the passed key to the changes set.  If a '*' was passed, then
      // add all keys in the observers to the set...
      // once finished, clear the key so the loop will end.
      if (key === '*') {
        changes.add('*') ;
        changes.addEach(this._kvo_for('_kvo_observed_keys', SC.Set));

      } else if (key) changes.add(key) ;

      // Now go through the set and add all dependent keys...
      if (dependents = this._kvo_dependents) {

        // NOTE: each time we loop, we check the changes length, this
        // way any dependent keys added to the set will also be evaluated...
        for(idx=0;idx<changes.length;idx++) {
          key = changes[idx] ;
          keys = dependents[key] ;
          
          // for each dependent key, add to set of changes.  Also, if key
          // value is a cacheable property, clear the cached value...
          if (keys && (loc = keys.length)) {
            while(--loc >= 0) {
              changes.add(key = keys[loc]);
              if ((func = this[key]) && func.isCacheable) {
                this[func.cacheKey] = undefined;
              } // if (func=)
            } // while (--loc)
          } // if (keys && 
        } // for(idx...
      } // if (dependents...)

      // now iterate through all changed keys and notify observers.
      while(changes.length > 0) {
        key = changes.pop() ; // the changed key

        // find any observers and notify them...
        observers = this[SC.keyFor('_kvo_observers', key)];
        if (observers) {
          members = observers.getMembers() ;
          membersLength = members.length ;
          for(memberLoc=0;memberLoc < membersLength; memberLoc++) {
            member = members[memberLoc] ;
            if (member[2] === rev) continue ; // skip notified items.
            target = member[0] || this; method = member[1] ; member[2] = rev;
            method.call(target, this, key, null, rev) ;
          }
        }

        // look for local observers.  Local observers are added by SC.Object
        // as an optimization to avoid having to add observers for every 
        // instance when you are just observing your local object.
        members = this[SC.keyFor('_kvo_local', key)];
        if (members) {
          membersLength = members.length ;
          for(memberLoc=0;memberLoc<membersLength;memberLoc++) {
            member = members[memberLoc];
            method = this[member] ; // try to find observer function
            if (method) method.call(this, this, key, null, rev);
          }
        }
        
        // if there are starObservers, do the same thing for them
        if (starObservers && key !== '*') {          
          members = starObservers.getMembers() ;
          membersLength = members.length ;
          for(memberLoc=0;memberLoc < membersLength; memberLoc++) {
            member = members[memberLoc] ;
            target = member[0] || this; method = member[1] ;
            method.call(target, this, key, null, rev) ;
          }
        }

        // if there is a default property observer, call that also
        if (this.propertyObserver) {
          this.propertyObserver(this, key, null, rev);
        }
      } // while(changes.length>0)

      // changes set should be empty. save this set so it can be reused later
      this._kvo_altChanges = changes ;
      
      // key is no longer needed; clear it to avoid infinite loops
      key = null ; 
      
    } // while (changes)
    
    // done with loop, reduce change level so that future sets can resume
    this._kvo_changeLevel = (this._kvo_changeLevel || 1) - 1; 
    return YES ; // finished successfully
  },

  // ..........................................
  // BINDINGS
  // 
    
  /**  
    Manually add a new binding to an object.  This is the same as doing
    the more familiar propertyBinding: 'property.path' approach.
    
    @param {String} toKey the key to bind to
    @param {Object} target target or property path to bind from
    @param {String|Function} method method for target to bind from
    @returns {SC.Binding} new binding instance
  */
  bind: function(toKey, target, method) {

    var binding ;

    // normalize...
    if (method !== undefined) target = [target, method];

    // if a string or array (i.e. tuple) is passed, convert this into a
    // binding.  If a binding default was provided, use that.
    var pathType = SC.typeOf(target) ;
    if (pathType === SC.T_STRING || pathType === SC.T_ARRAY) {
      binding = this[toKey + 'BindingDefault'] || SC.Binding;
      binding = binding.beget().from(target) ;
    } else binding = target ;

    // finish configuring the binding and then connect it.
    binding = binding.to(toKey, this).connect() ;
    this.bindings.push(binding) ;
    
    return binding ;
  },
  
  /**  
    didChangeFor makes it easy for you to verify that you haven't seen any
    changed values.  You need to use this if your method observes multiple
    properties.  To use this, call it like this:
  
    if (this.didChangeFor('render','height','width')) {
       // DO SOMETHING HERE IF CHANGED.
    }
  */  
  didChangeFor: function(context) { 
    
    context = SC.hashFor(context) ; // get a hash key we can use in caches.
    
    // setup caches...
    var valueCache = this._kvo_didChange_valueCache ;
    if (!valueCache) valueCache = this._kvo_didChange_valueCache = {};
    var revisionCache = this._kvo_didChange_revisionCache;
    if (!revisionCache) revisionCache=this._kvo_didChange_revisionCache={};

    // get the cache of values and revisions already seen in this context
    var seenValues = valueCache[context] || {} ;
    var seenRevisions = revisionCache[context] || {} ;
    
    // prepare too loop!
    var ret = false ;
    var currentRevision = this._kvo_revision || 0  ;
    var idx = arguments.length ;
    while(--idx >= 1) {  // NB: loop only to 1 to ignore context arg.
      var key = arguments[idx];
      
      // has the kvo revision changed since the last time we did this?
      if (seenRevisions[key] != currentRevision) {
        // yes, check the value with the last seen value
        var value = this.get(key) ;
        if (seenValues[key] !== value) ret = true ; // did change!
      }
      seenRevisions[key] = currentRevision;
    }
    
    valueCache[context] = seenValues ;
    revisionCache[context] = seenRevisions ;
    return ret ;
  },



  /**
    Sets the property only if the passed value is different from the
    current value.  Depending on how expensive a get() is on this property,
    this may be more efficient.
    
    @param key {String} the key to change
    @param value {Object} the value to change
    @returns {this}
  */
  setIfChanged: function(key, value) {
    return (this.get(key) !== value) ? this.set(key, value) : this ;
  },
  
  /**  
    Navigates the property path, returning the value at that point.
    
    If any object in the path is undefined, returns undefined.
  */
  getPath: function(path) {
    var tuple = SC.tupleForPropertyPath(path, this) ;
    if (tuple === null || tuple[0] === null) return undefined ;
    return tuple[0].get(tuple[1]) ;
  },
  
  /**
    Navigates the property path, finally setting the value.
    
    @param path {String} the property path to set
    @param value {Object} the value to set
    @returns {this}
  */
  setPath: function(path, value) {
    if (path.indexOf('.') >= 0) {
      var tuple = SC.tupleForPropertyPath(path, this) ;
      if (!tuple[0]) return null ;
      tuple[0].set(tuple[1], value) ;
    } else this.set(path, value) ; // shortcut
    return this;
  },

  /**
    Navigates the property path, finally setting the value but only if 
    the value does not match the current value.  This will avoid sending
    unecessary change notifications.
    
    @param path {String} the property path to set
    @param value {Object} the value to set
    @returns {Object} this
  */
  setPathIfChanged: function(path, value) {
    if (path.indexOf('.') >= 0) {
      var tuple = SC.tupleForPropertyPath(path, this) ;
      if (!tuple[0]) return null ;
      if (tuple[0].get(tuple[1]) !== value) {
        tuple[0].set(tuple[1], value) ;
      }
    } else this.setIfChanged(path, value) ; // shortcut
    return this;
  },
  
  /** 
    Convenience method to get an array of properties.
    
    Pass in multiple property keys or an array of property keys.  This
    method uses getPath() so you can also pass key paths.

    @returns {Array} Values of property keys.
  */
  getEach: function() {
    var keys = SC.$A(arguments).flatten() ;
    var ret = [];
    for(var idx=0; idx<keys.length;idx++) {
      ret[ret.length] = this.getPath(keys[idx]);
    }
    return ret ;
  },
  
  
  /**  
    Increments the value of a property.
    
    @param key {String} property name
    @returns {Number} new value of property
  */
  incrementProperty: function(key) { 
    this.set(key,(this.get(key) || 0)+1); 
    return this.get(key) ;
  },

  /**  
    decrements a property
    
    @param key {String} property name
    @returns {Number} new value of property
  */
  decrementProperty: function(key) {
    this.set(key,(this.get(key) || 0) - 1 ) ;
    return this.get(key) ;
  },

  /**  
    Inverts a property.  Property should be a bool.
    
    @param key {String} property name
    @param value {Object} optional parameter for "true" value
    @param alt {Object} optional parameter for "false" value
    @returns {Object} new value
  */
  toggleProperty: function(key,value,alt) { 
    if (value === undefined) value = true ;
    if (alt === undefined) alt = false ;
    value = (this.get(key) == value) ? alt : value ;
    this.set(key,value);
    return this.get(key) ;
  },

  /**  
    Generic property observer called whenever a property on the receiver 
    changes.
    
    If you need to observe a large number of properties on your object, it
    is sometimes more efficient to implement this observer only and then to
    handle requests yourself.  Although this observer will be triggered 
    more often than an observer registered on a specific property, it also
    does not need to be registered which can make it faster to setup your 
    object instance.
    
    You will often implement this observer using a switch statement on the
    key parameter, taking appropriate action. 
    
    @param observer {null} no longer used; usually null
    @param target {Object} the target of the change.  usually this
    @param key {String} the name of the property that changed
    @param value {Object} the new value of the property.
    @param revision {Number} a revision you can use to quickly detect changes.
    @returns {void}
  */
  propertyObserver: function(observer,target,key,value, revision) {},

  /**
    Convenience method to call propertyWillChange/propertyDidChange.
    
    Sometimes you need to notify observers that a property has changed value 
    without actually changing this value.  In those cases, you can use this 
    method as a convenience instead of calling propertyWillChange() and 
    propertyDidChange().
    
    @param key {String} The property key that has just changed.
    @param value {Object} The new value of the key.  May be null.
    @returns {this}
  */
  notifyPropertyChange: function(key, value) {
    this.propertyWillChange(key) ;
    this.propertyDidChange(key, value) ;
    return this; 
  },
  
  /**  
    Notifies all of observers of a property changes.
    
    Sometimes when you make a major update to your object, it is cheaper to
    simply notify all observers that their property might have changed than
    to figure out specifically which properties actually did change.
    
    In those cases, you can simply call this method to notify all property
    observers immediately.  Note that this ignores property groups.
    
    @returns {this}
  */
  allPropertiesDidChange: function() {
    this._notifyPropertyObservers('*') ;
    return this ;
  },

  addProbe: function(key) { this.addObserver(key,SC.logChange); },
  removeProbe: function(key) { this.removeObserver(key,SC.logChange); },

  /**
    Logs the named properties to the console.
    
    @param propertyNames one or more property names
  */
  logProperty: function() {
    var props = SC.$A(arguments) ;
    for(var idx=0;idx<props.length; idx++) {
      var prop = props[idx] ;
      console.log('%@:%@: '.fmt(SC.guidFor(this), prop), this.get(prop)) ;
    }
  },
  
  /**  
    This method will listen for the observed value to change one time and 
    then will remove itself.  You can also set an optional timeout that
    will cause the function to be triggered (and the observer removed) after
    a set amount of time even if the value never changes.  The function
    can expect an extra parameter, 'didTimeout', set to true.
  
    The returned value is the function actually set as the observer. You
    can manually remove this observer by calling the cancel() method on it.
  */
  observeOnce: function(key, target, method, timeout) {
    
    // fixup the params
    var targetType = SC.typeOf(target) ;
    if (targetType === SC.T_FUNCTION) {
      if ((SC.typeOf(method) === SC.T_NUMBER) && (timeout === undefined)) {
        timeout = method ;
      }
      method = target ;
      target = this ;
    }
    
    // convert the method to a function if needed...
    if (SC.typeOf(method) === SC.T_STRING) method = target[method] ;
    if (!method) throw "You must pass a valid method to observeOnce()";

    var timeoutObject = null ;

    // define a custom observer that will call the target method and remove
    // itself as an observer.
    var handler = function(observer, target, property, value, rev, didTimeout) {
      // invoke method...
      method.call(this, observer, target, property, value, rev, didTimeout);
      
      // remove observer...
      target.removeObserver(key, this, handler) ;
      
      // if there is a timeout, invalidate it.
      if (timeoutObject) { timeoutObject.invalidate();}
      
      // avoid memory leaks
      handler = target = method = timeoutObject = null;
    } ;

    // now add observer
    target.addObserver(key, target, handler) ;
    if (timeout) {
      timeoutObject = function() {
        handler(null, target, key, target.get(key), target.propertyRevision, true) ;
        handler = target = method = timeoutObject = null;
      }.invokeLater(this, timeout) ;
    }

    handler.cancel = function() { 
      target.removeObserver(key, target, handler); 
      handler = target = method = timeoutObject = null;
    } ;

    return handler ;
  },

  propertyRevision: 1
    
} ;

/** @private used by addProbe/removeProbe */
SC.logChange = function logChange(target, key, value) {
  console.log("CHANGE: %@[%@] => %@".fmt(target, key, value)) ;
};

// Make all Array's observable
SC.mixin(Array.prototype, SC.Observable) ;
