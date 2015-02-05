// ==========================================================================
// Project:   SC.Statechart - A Statechart Framework for SproutCore
// Copyright: ©2010, 2011 Michael Cohen, and contributors.
//            Portions @2011 Apple Inc. All rights reserved.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

/*globals SC */

//@if(debug)
SC.TRACE_STATECHART_STYLE = {
  init: 'font-style: italic; font-weight: bold;', // Initialization
  action: 'color: #5922ab; font-style: italic; font-weight: bold;', // Actions and events
  actionInfo: 'color: #5922ab; font-style: italic;', // Actions and events
  route: 'color: #a67000; font-style: italic;', // Routing
  gotoSubstate: 'color: #479a48; font-style: italic; font-weight: bold;', // Goto state
  gotoSubstateInfo: 'color: #479a48; font-style: italic;', // Goto state
  enter: 'color: #479a48; font-style: italic; font-weight: bold;', // Entering
  exit: 'color: #479a48; font-style: italic; font-weight: bold;' // Exiting
};
//@endif

/**
  @class

  Represents a substate within a state.

  The statechart actively manages all substates belonging to it. When a substate is created,
  it immediately registers itself with it parent substates.

  You do not create an instance of a substate itself. The statechart manager will go through its
  substate heirarchy and create the substate itself.

  For more information on using statecharts, see SC.StatechartManager.

  @author Michael Cohen
  @extends SC.Object
*/
SC.Substate = SC.Object.extend(
  /** @scope SC.Substate.prototype */ {

  //@if(debug)
  /* BEGIN DEBUG ONLY PROPERTIES AND METHODS */

  /**
    Indicates if this state should trace actions. Useful for debugging
    purposes. Managed by the statechart.

    @see SC.StatechartManager#trace

    @type Boolean
  */
  trace: function () {
    var key = this.getPath('statechart.statechartTraceKey');
    return this.getPath('statechart.%@'.fmt(key));
  }.property().cacheable(),

  /** @private */
  _statechartTraceDidChange: function () {
    this.notifyPropertyChange('trace');
  },

  /**
    Used to log a state trace message
  */
  stateLogTrace: function (msg, style) {
    var sc = this.get('statechart');
    sc.statechartLogTrace("  %@: %@".fmt(this, msg), style);
  },

  /* END DEBUG ONLY PROPERTIES AND METHODS */
  //@endif

  /**
    The name of the state

    @type String
  */
  name: null,

  /**
    This state's parent state. Managed by the statechart

    @type State
  */
  parentState: null,

  /**
    This state's history state. Can be null. Managed by the statechart.

    @type State
  */
  historyState: null,

  /**
    Used to indicate the initial substate of this state to enter into.

    You assign the value with the name of the state. Upon creation of
    the state, the statechart will automatically change the property
    to be a corresponding state object

    The substate is only to be this state's immediate substates. If
    no initial substate is assigned then this states initial substate
    will be an instance of an empty state (SC.EmptyState).

    Note that a statechart's root state must always have an explicity
    initial substate value assigned else an error will be thrown.

    @property {String|State}
  */
  initialSubstate: null,

  /**
    Used to indicates if this state's immediate substates are to be
    concurrent (orthogonal) to each other.

    @type Boolean
  */
  substatesAreConcurrent: NO,

  /**
    The immediate substates of this state. Managed by the statechart.

    @type Array
  */
  substates: null,

  /**
    @type Object
  */
  eventTransitions: null,

  /**
    The statechart that this state belongs to. Assigned by the owning
    statechart.

    @type Statechart
  */
  statechart: null,

  /**
    Indicates if this state has been initialized by the statechart

    @propety {Boolean}
  */
  stateIsInitialized: NO,

  /**
    An array of this state's current substates. Managed by the statechart

    @propety {Array}
  */
  currentSubstates: null,

  /**
    An array of this state's substates that are currently entered. Managed by
    the statechart.

    @type Array
  */
  enteredSubstates: null,

  /**
    Indicates who the owner is of this state. If not set on the statechart
    then the owner is the statechart, otherwise it is the assigned
    object. Managed by the statechart.

    @see SC.StatechartManager#owner

    @type SC.Object
  */
  owner: function () {
    var sc = this.get('statechart'),
        key = sc ? sc.get('statechartOwnerKey') : null,
        owner = sc ? sc.get(key) : null;
    return owner ? owner : sc;
  }.property().cacheable(),

  init: function () {
    sc_super();

    this._registeredEventHandlers = {};
    this._registeredStringEventHandlers = {};
    this._registeredRegExpEventHandlers = [];
    this._registeredStateObserveHandlers = {};
    this._registeredSubstatePaths = {};
    this._registeredSubstates = [];
    this._isEnteringState = NO;
    this._isExitingState = NO;

    // Setting up observes this way is faster then using .observes,
    // which adds a noticable increase in initialization time.

    var sc = this.get('statechart'),
        ownerKey = sc ? sc.get('statechartOwnerKey') : null;

    if (sc) {
      sc.addObserver(ownerKey, this, '_statechartOwnerDidChange');

      //@if(debug)
      var traceKey = sc ? sc.get('statechartTraceKey') : null;
      sc.addObserver(traceKey, this, '_statechartTraceDidChange');
      //@endif
    }
  },

  destroy: function () {
    var sc = this.get('statechart'),
        ownerKey = sc ? sc.get('statechartOwnerKey') : null;

    if (sc) {
      sc.removeObserver(ownerKey, this, '_statechartOwnerDidChange');

      //@if(debug)
      var traceKey = sc ? sc.get('statechartTraceKey') : null;
      sc.removeObserver(traceKey, this, '_statechartTraceDidChange');
      //@endif
    }

    var substates = this.get('substates');
    if (substates) {
      substates.forEach(function (state) {
        state.destroy();
      });
    }

    this._teardownAllStateObserveHandlers();

    this.set('substates', null);
    this.set('currentSubstates', null);
    this.set('enteredSubstates', null);
    this.set('parentState', null);
    this.set('historyState', null);
    this.set('initialSubstate', null);
    this.set('statechart', null);

    //@if(debug)
    this.notifyPropertyChange('trace');
    //@endif

    this.notifyPropertyChange('owner');

    this._registeredEventHandlers = null;
    this._registeredStringEventHandlers = null;
    this._registeredRegExpEventHandlers = null;
    this._registeredStateObserveHandlers = null;
    this._registeredSubstatePaths = null;
    this._registeredSubstates = null;

    sc_super();
  },

  /**
    Used to initialize this state. To only be called by the owning statechart.
  */
  initState: function () {
    if (this.get('stateIsInitialized')) return;

    this._registerWithParentStates();

    var key = null,
        value = null,
        state = null,
        substates = [],
        matchedInitialSubstate = NO,
        initialSubstate = this.get('initialSubstate'),
        substatesAreConcurrent = this.get('substatesAreConcurrent'),
        i = 0,
        len = 0,
        valueIsFunc = NO,
        historyState = null;

    this.set('substates', substates);

    if (SC.kindOf(initialSubstate, SC.HistoryState) && initialSubstate.isClass) {
      historyState = this.createSubstate(initialSubstate);
      this.set('initialSubstate', historyState);

      if (SC.none(historyState.get('defaultState'))) {
        this.stateLogError("Initial substate is invalid. History state requires the name of a default state to be set");
        this.set('initialSubstate', null);
        historyState = null;
      }
    }

    // Iterate through all this state's substates, if any, create them, and then initialize
    // them. This causes a recursive process.
    for (key in this) {
      value = this[key];
      valueIsFunc = SC.typeOf(value) === SC.T_FUNCTION;

      if (valueIsFunc && value.isEventHandler) {
        this._sc_registerEventHandler(key, value);
        continue;
      }

      if (valueIsFunc && value.isStateObserveHandler) {
        this._registerStateObserveHandler(key, value);
        continue;
      }

      if (valueIsFunc && value.statePlugin) {
        value = value.apply(this);
      }

      if (SC.kindOf(value, SC.Substate) && value.isClass && this[key] !== this.constructor) {
        state = this._addSubstate(key, value);
        if (key === initialSubstate) {
          this.set('initialSubstate', state);
          matchedInitialSubstate = YES;
        } else if (historyState && historyState.get('defaultState') === key) {
          historyState.set('defaultState', state);
          matchedInitialSubstate = YES;
        }
      }
    }

    if (!SC.none(initialSubstate) && !matchedInitialSubstate) {
      this.stateLogError("Unable to set initial substate %@ since it did not match any of state's %@ substates".fmt(initialSubstate, this));
    }

    if (substates.length === 0) {
      if (!SC.none(initialSubstate)) {
        this.stateLogWarning("Unable to make %@ an initial substate since state %@ has no substates".fmt(initialSubstate, this));
      }
    }
    else if (substates.length > 0) {
      state = this._addEmptyInitialSubstateIfNeeded();
      if (!state && initialSubstate && substatesAreConcurrent) {
        this.set('initialSubstate', null);
        this.stateLogWarning("Can not use %@ as initial substate since substates are all concurrent for state %@".fmt(initialSubstate, this));
      }
    }

    // Set up the substate transitions.
    this._transitionsForEvent = {};
    this._sc_handleEventTransition.events = [];
    for (var eventName in this.eventTransitions) {
      this._transitionsForEvent[eventName] = {};
      var transitionPatterns = this.eventTransitions[eventName];

      for (i = 0, len = transitionPatterns.length; i < len; i++) {
        var transitionPattern = transitionPatterns[i];

        transitionPattern = transitionPattern.split(/\s*->\s*/);
        this._transitionsForEvent[eventName][this.getSubstate(transitionPattern[0])] = transitionPattern[1];
      }

      // Add the event to our generic substate transition handler.
      this._sc_handleEventTransition.events.push(eventName);
    }

    this._sc_registerEventHandler('_sc_handleEventTransition', this._sc_handleEventTransition);

    this.notifyPropertyChange('substates');
    this.set('currentSubstates', []);
    this.set('enteredSubstates', []);
    this.set('stateIsInitialized', YES);
  },

  _sc_handleEventTransition: function (eventName, context) {
    // Search through all the current substates for the originator of the event.
    var enteredSubstates = this.get('enteredSubstates');
    for (var i = 0, len = enteredSubstates.length; i < len; i++) {
      var enteredSubstate = enteredSubstates[i],
        transitionSubstate = this._transitionsForEvent[eventName][enteredSubstate];

      // If the current substate is a source for the event, use it.
      if (!SC.none(transitionSubstate)) {
        this.gotoSubstate(transitionSubstate, context);

        // Found a match.
        return true;
      }
    }

    // Didn't find a match.
    return false;
  },

  /** @private */
  _addEmptyInitialSubstateIfNeeded: function () {
    var initialSubstate = this.get('initialSubstate'),
        substatesAreConcurrent = this.get('substatesAreConcurrent');

    if (initialSubstate || substatesAreConcurrent) return null;

    var state = this.createSubstate(SC.EmptyState);
    this.set('initialSubstate', state);
    this.get('substates').push(state);
    this[state.get('name')] = state;
    state.initState();
    this.stateLogWarning("state %@ has no initial substate defined. Will default to using an empty state as initial substate".fmt(this));
    return state;
  },

  /** @private */
  _addSubstate: function (name, state, attr) {
    var substates = this.get('substates');

    attr = SC.clone(attr) || {};
    attr.name = name;
    state = this.createSubstate(state, attr);
    substates.push(state);
    this[name] = state;
    state.initState();
    return state;
  },

  /**
    Used to dynamically add a substate to this state. Once added successfully you
    are then able to go to it from any other state within the owning statechart.

    A couple of notes when adding a substate:

    - If this state does not have any substates, then in addition to the
      substate being added, an empty state will also be added and set as the
      initial substate. To make the added substate the initial substate, set
      this object's initialSubstate property.

    - If this state is a current state, the added substate will not be entered.

    - If this state is entered and its substates are concurrent, the added
      substate will not be entered.

    If this state is either entered or current and you'd like the added substate
    to take affect, you will need to explicitly reenter this state by calling
    its `reenter` method.

    Be aware that the name of the state you are adding must not conflict with
    the name of a property on this state or else you will get an error.
    In addition, this state must be initialized to add substates.

    @param {String} name a unique name for the given substate.
    @param {SC.Substate} state a class that derives from `SC.Substate`
    @returns {SC.Substate} an instance of the given state class
    @param {Object} [attr] literal to be applied to the substate
  */
  addSubstate: function (name, state, attr) {
    if (SC.empty(name)) {
      this.stateLogError("Can not add substate. name required");
      return null;
    }

    if (this[name] !== undefined) {
      this.stateLogError("Can not add substate '%@'. Already a defined property".fmt(name));
      return null;
    }

    if (!this.get('stateIsInitialized')) {
      this.stateLogError("Can not add substate '%@'. this state is not yet initialized".fmt(name));
      return null;
    }

    var len = arguments.length;

    if (len === 1) {
      state = SC.Substate;
    } else if (len === 2 && SC.typeOf(state) === SC.T_HASH) {
      attr = state;
      state = SC.Substate;
    }

    var stateIsValid = SC.kindOf(state, SC.Substate) && state.isClass;

    if (!stateIsValid) {
      this.stateLogError("Can not add substate '%@'. must provide a state class".fmt(name));
      return null;
    }

    state = this._addSubstate(name, state, attr);
    this._addEmptyInitialSubstateIfNeeded();
    this.notifyPropertyChange('substates');

    return state;
  },

  /**
    creates a substate for this state
  */
  createSubstate: function (state, attr) {
    attr = attr || {};
    return state.create({
      parentState: this,
      statechart: this.get('statechart')
    }, attr);
  },

  /** @private

    Registers event handlers with this state. Event handlers are special
    functions on the state that are intended to handle more than one event. This
    compared to basic functions that only respond to a single event that reflects
    the name of the method.
  */
  _sc_registerEventHandler: function (name, handler) {
    var events = handler.events,
        event = null,
        len = events.length,
        i = 0;

    this._registeredEventHandlers[name] = handler;

    for (; i < len; i += 1) {
      event = events[i];

      if (SC.typeOf(event) === SC.T_STRING) {
        this._registeredStringEventHandlers[event] = {
          name: name,
          handler: handler
        };
        continue;
      }

      if (event instanceof RegExp) {
        this._registeredRegExpEventHandlers.push({
          name: name,
          handler: handler,
          regexp: event
        });
        continue;
      }

      this.stateLogError("Invalid event %@ for event handler %@ in state %@".fmt(event, name, this));
    }
  },

  /** @private

    Registers state observe handlers with this state. State observe handlers behave just like
    when you apply observes() on a method but will only be active when the state is currently
    entered, otherwise the handlers are inactive until the next time the state is entered
  */
  _registerStateObserveHandler: function (name, handler) {
    var i = 0,
        args = handler.args,
        len = args.length,
        arg, validHandlers = YES;

    for (; i < len; i += 1) {
      arg = args[i];
      if (SC.typeOf(arg) !== SC.T_STRING || SC.empty(arg)) {
        this.stateLogError("Invalid argument %@ for state observe handler %@ in state %@".fmt(arg, name, this));
        validHandlers = NO;
      }
    }

    if (!validHandlers) return;

    this._registeredStateObserveHandlers[name] = handler.args;
  },

  /** @private
    Will traverse up through this state's parent states to register
    this state with them.
  */
  _registerWithParentStates: function () {
    var parent = this.get('parentState');
    while (!SC.none(parent)) {
      parent._registerSubstate(this);
      parent = parent.get('parentState');
    }
  },

  /** @private
    Will register a given state as a substate of this state
  */
  _registerSubstate: function (state) {
    var path = state.pathRelativeTo(this);
    if (SC.none(path)) return;

    this._registeredSubstates.push(state);

    // Keep track of states based on their relative path
    // to this state.
    var regPaths = this._registeredSubstatePaths;
    if (regPaths[state.get('name')] === undefined) {
      regPaths[state.get('name')] = { };
    }

    var paths = regPaths[state.get('name')];
    paths[path] = state;
  },

  /**
    Will generate path for a given state that is relative to this state. It is
    required that the given state is a substate of this state.

    If the heirarchy of the given state to this state is the following:
    A > B > C, where A is this state and C is the given state, then the
    relative path generated will be "B.C"
  */
  pathRelativeTo: function (state) {
    var path = this.get('name'),
        parent = this.get('parentState');

    while (!SC.none(parent) && parent !== state) {
      path = "%@.%@".fmt(parent.get('name'), path);
      parent = parent.get('parentState');
    }

    if (parent !== state && state !== this) {
      this.stateLogError('Can not generate relative path from %@ since it not a parent state of %@'.fmt(state, this));
      return null;
    }

    return path;
  },

  /**
    Used to get a substate of this state that matches a given value.

    If the value is a state object, then the value will be returned if it is indeed
    a substate of this state, otherwise null is returned.

    If the given value is a string, then the string is assumed to be a path expression
    to a substate. The value is then parsed to find the closest match. For path expression
    syntax, refer to the {@link SC.StatePathMatcher} class.

    If there is no match then null is returned. If there is more than one match then null
    is return and an error is generated indicating ambiguity of the given value.

    An optional callback can be provided to handle the scenario when either no
    substate is found or there is more than one match. The callback is then given
    the opportunity to further handle the outcome and return a result which the
    getSubstate method will then return. The callback should have the following
    signature:

      function (state, value, paths)

    - state: The state getState was invoked on
    - value: The value supplied to getState
    - paths: An array of substate paths that matched the given value

    If there were no matches then `paths` is not provided to the callback.

    You can also optionally provide a target that the callback is invoked on. If no
    target is provided then this state is used as the target.

    @param value {State|String} used to identify a substate of this state
    @param [callback] {Function} the callback
    @param [target] {Object} the target
  */
  getSubstate: function (value, callback, target) {
    if (!value) return null;

    var valueType = SC.typeOf(value);

    // If the value is an object then just check if the value is
    // a registered substate of this state, and if so return it.
    if (valueType === SC.T_OBJECT) {
      return this._registeredSubstates.indexOf(value) > -1 ? value : null;
    }

    if (valueType !== SC.T_STRING) {
      this.stateLogError("Can not find matching subtype. value must be an object or string: %@".fmt(value));
      return null;
    }

    var matcher = SC.StatePathMatcher.create({ state: this, expression: value }),
        matches = [], key;

    if (matcher.get('tokens').length === 0) return null;

    var paths = this._registeredSubstatePaths[matcher.get('lastPart')];
    if (!paths) return this._notifySubstateNotFound(callback, target, value);

    for (key in paths) {
      if (matcher.match(key)) {
        matches.push(paths[key]);
      }
    }

    if (matches.length === 1) return matches[0];

    if (matches.length > 1) {
      var keys = [];
      for (key in paths) { keys.push(key); }

      if (callback) return this._notifySubstateNotFound(callback, target, value, keys);

      var msg = "Can not find substate matching '%@' in state %@. Ambiguous with the following: %@";
      this.stateLogError(msg.fmt(value, this.get('fullPath'), keys.join(', ')));
    }

    return this._notifySubstateNotFound(callback, target, value);
  },

  /** @private */
  _notifySubstateNotFound: function (callback, target, value, keys) {
    return callback ? callback.call(target || this, this, value, keys) : null;
  },

  /**
    Will attempt to get a state relative to this state.

    A state is returned based on the following:

    1. First check this state's substates for a match; and
    2. If no matching substate then attempt to get the state from
       this state's parent state.

    Therefore states are recursively traversed up to the root state
    to identify a match, and if found is ultimately returned, otherwise
    null is returned. In the case that the value supplied is ambiguous
    an error message is returned.

    The value provided can either be a state object or a state path expression.
    For path expression syntax, refer to the {@link SC.StatePathMatcher} class.
  */
  getState: function (value) {
    if (value === this.get('name')) return this;
    if (SC.kindOf(value, SC.Substate)) return value;
    return this.getSubstate(value, this._handleSubstateNotFound);
  },

  /** @private */
  _handleSubstateNotFound: function (state, value, keys) {
    var parentState = this.get('parentState');

    if (parentState) return parentState.getState(value);

    if (keys) {
      var msg = "Can not find state matching '%@'. Ambiguous with the following: %@";
      this.stateLogError(msg.fmt(value, keys.join(', ')));
    }

    return null;
  },

  /**
    Go to a descendent substate of this substate.

    If the value given is a string then it is considered a state path expression. The path is then
    used to find a state relative to this state based on rules of the {@link #getState} method.

    @param value {SC.Substate|String} the state to go to
    @param [context] {Hash|Object} context object that will be supplied to all states that are
           exited and entered during the state transition process. Context can not be an instance of
           SC.Substate.
  */
  gotoSubstate: function (value, context) {
    var state = this.getSubstate(value);

    if (!state) {
      var msg = "can not go to state %@ from state %@. Invalid value.";
      this.stateLogError(msg.fmt(value, this));
      return;
    }

    var from = this.findFirstRelativeCurrentState(state);
    this.get('statechart').gotoState(state, from, false, context);
  },

  /** @private
    Used to go to a substate in the statechart either directly from this state if it is a current
    state, or from the first relative current state from this state.

    If the value given is a string then it is considered a state path expression. The path is then
    used to find a state relative to this state based on rules of the {@link #getState} method.

    @param value {SC.Substate|String} the state to go to
    @param [context] {Hash|Object} context object that will be supplied to all states that are
           exited and entered during the state transition process. Context can not be an instance of
           SC.Substate.
  */
  // gotoState: function (value, context) {
  //   var state = this.getState(value);

  //   if (!state) {
  //     var msg = "can not go to state %@ from state %@. Invalid value.";
  //     this.stateLogError(msg.fmt(value, this));
  //     return;
  //   }

  //   var from = this.findFirstRelativeCurrentState(state);
  //   this.get('statechart').gotoState(state, from, false, context);
  // },

  /**
    Used to go to a given state's history state in the statechart either directly from this state if it
    is a current state or from one of this state's current substates.

    If the value given is a string then it is considered a state path expression. The path is then
    used to find a state relative to this state based on rules of the {@link #getState} method.

    Method can be called in the following ways:

        // With one argument
        gotoHistoryState(<value>)

        // With two arguments
        gotoHistoryState(<value>, <boolean | hash>)

        // With three arguments
        gotoHistoryState(<value>, <boolean>, <hash>)

    Where <value> is either a string or a SC.Substate object and <hash> is a regular JS hash object.

    @param value {SC.Substate|String} the state whose history state to go to
    @param [recusive] {Boolean} indicates whether to follow history states recusively starting
           from the given state
    @param [context] {Hash|Object} context object that will be supplied to all states that are exited
           entered during the state transition process. Context can not be an instance of SC.Substate.
  */
  gotoHistoryState: function (value, recursive, context) {
    var state = this.getState(value);

    if (!state) {
      var msg = "can not go to history state %@ from state %@. Invalid value.";
      this.stateLogError(msg.fmt(value, this));
      return;
    }

    var from = this.findFirstRelativeCurrentState(state);
    this.get('statechart').gotoHistoryState(state, from, recursive, context);
  },

  /**
    Resumes an active goto state transition process that has been suspended.
  */
  resumeGotoState: function () {
    this.get('statechart').resumeGotoState();
  },

  /**
    Used to check if a given state is a current substate of this state. Mainly used in cases
    when this state is a concurrent state.

    @param state {State|String} either a state object or the name of a state
    @returns {Boolean} true is the given state is a current substate, otherwise false is returned
  */
  stateIsCurrentSubstate: function (state) {
    if (SC.typeOf(state) === SC.T_STRING) state = this.get('statechart').getState(state);
    var current = this.get('currentSubstates');
    return !!current && current.indexOf(state) >= 0;
  },

  /**
    Used to check if a given state is a substate of this state that is currently entered.

    @param state {State|String} either a state object of the name of a state
    @returns {Boolean} true if the given state is a entered substate, otherwise false is returned
  */
  stateIsEnteredSubstate: function (state) {
    if (SC.typeOf(state) === SC.T_STRING) state = this.get('statechart').getState(state);
    var entered = this.get('enteredSubstates');
    return !!entered && entered.indexOf(state) >= 0;
  },

  /**
    Indicates if this state is the root state of the statechart.

    @type Boolean
  */
  isRootState: function () {
    return this.getPath('statechart.rootSubstate') === this;
  }.property(),

  /**
    Indicates if this state is a current state of the statechart.

    @type Boolean
  */
  isCurrentState: function () {
    return this.stateIsCurrentSubstate(this);
  }.property('currentSubstates').cacheable(),

  /**
    Indicates if this state is a concurrent state

    @type Boolean
  */
  isConcurrentState: function () {
    return this.getPath('parentState.substatesAreConcurrent');
  }.property(),

  /**
    Indicates if this state is a currently entered state.

    A state is currently entered if during a state transition process the
    state's enterSubstate method was invoked, but only after its exitSubstate method
    was called, if at all.
  */
  isEnteredState: function () {
    return this.stateIsEnteredSubstate(this);
  }.property('enteredSubstates').cacheable(),

  /**
    Indicate if this state has any substates

    @propety {Boolean}
  */
  hasSubstates: function () {
    return this.getPath('substates.length') > 0;
  }.property('substates'),

  /**
    Indicates if this state has any current substates
  */
  hasCurrentSubstates: function () {
    var current = this.get('currentSubstates');
    return !!current && current.get('length') > 0;
  }.property('currentSubstates').cacheable(),

  /**
    Indicates if this state has any currently entered substates
  */
  hasEnteredSubstates: function () {
    var entered = this.get('enteredSubstates');
    return !!entered  && entered.get('length') > 0;
  }.property('enteredSubstates').cacheable(),

  /**
    Will attempt to find a current state in the statechart that is relative to
    this state.

    Ordered set of rules to find a relative current state:

      1. If this state is a current state then it will be returned

      2. If this state has no current states and this state has a parent state then
        return parent state's first relative current state, otherwise return null

      3. If this state has more than one current state then use the given anchor state
         to get a corresponding substate that can be used to find a current state relative
         to the substate, if a substate was found.

      4. If (3) did not find a relative current state then default to returning
         this state's first current substate.

    @param anchor {State|String} Optional. a substate of this state used to help direct
      finding a current state
    @return {SC.Substate} a current state
  */
  findFirstRelativeCurrentState: function (anchor) {
    if (this.get('isCurrentState')) return this;

    var currentSubstates = this.get('currentSubstates') || [],
        numCurrent = currentSubstates.get('length'),
        parent = this.get('parentState');

    if (numCurrent === 0) {
      return parent ? parent.findFirstRelativeCurrentState() : null;
    }

    if (numCurrent > 1) {
      anchor = this.getSubstate(anchor);
      if (anchor) return anchor.findFirstRelativeCurrentState();
    }

    return currentSubstates[0];
  },

  /**
    Used to re-enter this state. Call this only when the state a current state of
    the statechart.
  */
  reenter: function () {
    if (this.get('isEnteredState')) {
      this.gotoSubstate(this);
    } else {
      SC.Logger.error('Can not re-enter state %@ since it is not an entered state in the statechart'.fmt(this));
    }
  },

  /**
    Called by the statechart to allow a state to try and handle the given event. If the
    event is handled by the state then YES is returned, otherwise NO.

    There is a particular order in how an event is handled by a state:

     1. Basic function whose name matches the event
     2. Registered event handler that is associated with an event represented as a string
     3. Registered event handler that is associated with events matching a regular expression
     4. The unknownEvent function

    Use of event handlers that are associated with events matching a regular expression may
    incur a performance hit, so they should be used sparingly.

    The unknownEvent function is only invoked if the state has it, otherwise it is skipped. Note that
    you should be careful when using unknownEvent since it can be either abused or cause unexpected
    behavior.

    Example of a state using all four event handling techniques:

        SC.Substate.extend({

          // Basic function handling event 'foo'
          foo: function (arg1, arg2) { ... },

          // event handler that handles 'frozen' and 'canuck'
          eventHandlerA: function (event, arg1, arg2) {
            ...
          }.handleEvent('frozen', 'canuck'),

          // event handler that handles events matching the regular expression /num\d/
          //   ex. num1, num2
          eventHandlerB: function (event, arg1, arg2) {
            ...
          }.handleEvent(/num\d/),

          // Handle any event that was not handled by some other
          // method on the state
          unknownEvent: function (event, arg1, arg2) {

          }

        });
  */
  tryToHandleEvent: function (event, arg1, arg2) {
    //@if(debug)
    var trace = this.get('trace');
    //@endif

    var sc = this.get('statechart'),
        ret;

    // First check if the name of the event is the same as a registered event handler. If so,
    // then do not handle the event.
    if (this._registeredEventHandlers[event]) {
      this.stateLogWarning("state %@ can not handle event '%@' since it is a registered event handler".fmt(this, event));
      return NO;
    }

    if (this._registeredStateObserveHandlers[event]) {
      this.stateLogWarning("state %@ can not handle event '%@' since it is a registered state observe handler".fmt(this, event));
      return NO;
    }

    // Now begin by trying a basic method on the state to respond to the event
    if (SC.typeOf(this[event]) === SC.T_FUNCTION) {
      //@if(debug)
      if (trace) this.stateLogTrace("will handle event '%@'".fmt(event), SC.TRACE_STATECHART_STYLE.actionInfo);
      //@endif
      sc.stateWillTryToHandleEvent(this, event, event);
      ret = (this[event](arg1, arg2) !== NO);
      sc.stateDidTryToHandleEvent(this, event, event, ret);
      return ret;
    }

    // Try an event handler that is associated with an event represented as a string
    var handler = this._registeredStringEventHandlers[event];
    if (handler) {
      //@if(debug)
      if (trace) this.stateLogTrace("%@ will handle event '%@'".fmt(handler.name, event), SC.TRACE_STATECHART_STYLE.actionInfo);
      //@endif
      sc.stateWillTryToHandleEvent(this, event, handler.name);
      ret = (handler.handler.call(this, event, arg1, arg2) !== NO);
      sc.stateDidTryToHandleEvent(this, event, handler.name, ret);
      return ret;
    }

    // Try an event handler that is associated with events matching a regular expression

    var len = this._registeredRegExpEventHandlers.length,
        i = 0;

    for (; i < len; i += 1) {
      handler = this._registeredRegExpEventHandlers[i];
      if (event.match(handler.regexp)) {
        //@if(debug)
        if (trace) this.stateLogTrace("%@ will handle event '%@'".fmt(handler.name, event), SC.TRACE_STATECHART_STYLE.actionInfo);
        //@endif
        sc.stateWillTryToHandleEvent(this, event, handler.name);
        ret = (handler.handler.call(this, event, arg1, arg2) !== NO);
        sc.stateDidTryToHandleEvent(this, event, handler.name, ret);
        return ret;
      }
    }

    // Final attempt. If the state has an unknownEvent function then invoke it to
    // handle the event
    if (SC.typeOf(this.unknownEvent) === SC.T_FUNCTION) {
      //@if(debug)
      if (trace) this.stateLogTrace("unknownEvent will handle event '%@'".fmt(event), SC.TRACE_STATECHART_STYLE.actionInfo);
      //@endif
      sc.stateWillTryToHandleEvent(this, event, 'unknownEvent');
      ret = (this.unknownEvent(event, arg1, arg2) !== NO);
      sc.stateDidTryToHandleEvent(this, event, 'unknownEvent', ret);
      return ret;
    }

    // Nothing was able to handle the given event for this state
    return NO;
  },

  /**
    Called whenever this state is to be entered during a state transition process. This
    is useful when you want the state to perform some initial set up procedures.

    If when entering the state you want to perform some kind of asynchronous action, such
    as an animation or fetching remote data, then you need to return an asynchronous
    action, which is done like so:

        enterSubstate: function () {
          return this.performAsync('foo');
        }

    After returning an action to be performed asynchronously, the statechart will suspend
    the active state transition process. In order to resume the process, you must call
    this state's resumeGotoState method or the statechart's resumeGotoState. If no asynchronous
    action is to be perform, then nothing needs to be returned.

    When the enterSubstate method is called, an optional context value may be supplied if
    one was provided to the gotoSubstate method.

    @param {Hash} [context] value if one was supplied to gotoSubstate when invoked

    @see #representRoute
  */
  enterSubstate: function (context) { },

  /**
    Notification called just before enterSubstate is invoked.

    Note: This is intended to be used by the owning statechart but it can be overridden if
    you need to do something special.

    @param {Hash} [context] value if one was supplied to gotoSubstate when invoked
    @see #enterSubstate
  */
  stateWillBecomeEntered: function (context) {
    this._isEnteringState = YES;
  },

  /**
    Notification called just after enterSubstate is invoked.

    Note: This is intended to be used by the owning statechart but it can be overridden if
    you need to do something special.

    @param context {Hash} Optional value if one was supplied to gotoSubstate when invoked
    @see #enterSubstate
  */
  stateDidBecomeEntered: function (context) {
    this._setupAllStateObserveHandlers();
    this._isEnteringState = NO;
  },

  /**
    Called whenever this state is to be exited during a state transition process. This is
    useful when you want the state to peform some clean up procedures.

    If when exiting the state you want to perform some kind of asynchronous action, such
    as an animation or fetching remote data, then you need to return an asynchronous
    action, which is done like so:

        exitSubstate: function () {
          return this.performAsync('foo');
        }

    After returning an action to be performed asynchronously, the statechart will suspend
    the active state transition process. In order to resume the process, you must call
    this state's resumeGotoState method or the statechart's resumeGotoState. If no asynchronous
    action is to be perform, then nothing needs to be returned.

    When the exitSubstate method is called, an optional context value may be supplied if
    one was provided to the gotoSubstate method.

    @param context {Hash} Optional value if one was supplied to gotoSubstate when invoked
  */
  exitSubstate: function (context) { },

  /**
    Notification called just before exitSubstate is invoked.

    Note: This is intended to be used by the owning statechart but it can be overridden
    if you need to do something special.

    @param context {Hash} Optional value if one was supplied to gotoSubstate when invoked
    @see #exitSubstate
  */
  stateWillBecomeExited: function (context) {
    this._isExitingState = YES;
    this._teardownAllStateObserveHandlers();
  },

  /**
    Notification called just after exitSubstate is invoked.

    Note: This is intended to be used by the owning statechart but it can be overridden
    if you need to do something special.

    @param context {Hash} Optional value if one was supplied to gotoSubstate when invoked
    @see #exitSubstate
  */
  stateDidBecomeExited: function (context) {
    this._isExitingState = NO;
  },

  /** @private

    Used to setup all the state observer handlers. Should be done when
    the state has been entered.
  */
  _setupAllStateObserveHandlers: function () {
    this._configureAllStateObserveHandlers('addObserver');
  },

  /** @private

    Used to teardown all the state observer handlers. Should be done when
    the state is being exited.
  */
  _teardownAllStateObserveHandlers: function () {
    this._configureAllStateObserveHandlers('removeObserver');
  },

  /** @private

    Primary method used to either add or remove this state as an observer
    based on all the state observe handlers that have been registered with
    this state.

    Note: The code to add and remove the state as an observer has been
    taken from the observerable mixin and made slightly more generic. However,
    having this code in two different places is not ideal, but for now this
    will have to do. In the future the code should be refactored so that
    there is one common function that both the observerable mixin and the
    statechart framework use.
  */
  _configureAllStateObserveHandlers: function (action) {
    var key, values, dotIndex, path, observer, i, root;

    for (key in this._registeredStateObserveHandlers) {
      values = this._registeredStateObserveHandlers[key];
      for (i = 0; i < values.length; i += 1) {
        path = values[i];
        observer = key;

        // Use the dot index in the path to determine how the state
        // should add itself as an observer.

        dotIndex = path.indexOf('.');

        if (dotIndex < 0) {
          this[action](path, this, observer);
        } else if (path.indexOf('*') === 0) {
          this[action](path.slice(1), this, observer);
        } else {
          root = null;

          if (dotIndex === 0) {
            root = this;
            path = path.slice(1);
          } else if (dotIndex === 4 && path.slice(0, 5) === 'this.') {
            root = this;
            path = path.slice(5);
          } else if (dotIndex < 0 && path.length === 4 && path === 'this') {
            root = this;
            path = '';
          }

          SC.Observers[action](path, this, observer, root);
        }
      }
    }
  },

  /**
    Call when an asynchronous action need to be performed when either entering or exiting
    a state.

    @see enterSubstate
    @see exitSubstate
  */
  performAsync: function (func, arg1, arg2) {
    return SC.Async.perform(func, arg1, arg2);
  },

  /** @override

    Returns YES if this state can respond to the given event, otherwise
    NO is returned

    @param event {String} the value to check
    @returns {Boolean}
  */
  respondsToEvent: function (event) {
    if (this._registeredEventHandlers[event]) return false;
    if (SC.typeOf(this[event]) === SC.T_FUNCTION) return true;
    if (this._registeredStringEventHandlers[event]) return true;
    if (this._registeredStateObserveHandlers[event]) return false;

    var len = this._registeredRegExpEventHandlers.length,
        i = 0,
        handler;

    for (; i < len; i += 1) {
      handler = this._registeredRegExpEventHandlers[i];
      if (event.match(handler.regexp)) return true;
    }

    return SC.typeOf(this.unknownEvent) === SC.T_FUNCTION;
  },

  /**
    Returns the path for this state relative to the statechart's
    root state.

    The path is a dot-notation string representing the path from
    this state to the statechart's root state, but without including
    the root state in the path. For instance, if the name of this
    state if "foo" and the parent state's name is "bar" where bar's
    parent state is the root state, then the full path is "bar.foo"

    @type String
  */
  fullPath: function () {
    var root = this.getPath('statechart.rootSubstate');
    if (!root) return this.get('name');
    return this.pathRelativeTo(root);
  }.property('name', 'parentState').cacheable(),

  toString: function () {
    return this.get('fullPath');
  },

  /** @private */
  _statechartOwnerDidChange: function () {
    this.notifyPropertyChange('owner');
  },

  /**
    Used to log a state warning message
  */
  stateLogWarning: function (msg) {
    var sc = this.get('statechart');
    sc.statechartLogWarning(msg);
  },

  /**
    Used to log a state error message
  */
  stateLogError: function (msg) {
    var sc = this.get('statechart');
    sc.statechartLogError(msg);
  }

});

/**
  Use this when you want to plug-in a state into a statechart. This is beneficial
  in cases where you split your statechart's states up into multiple files and
  don't want to fuss with the sc_require construct.

  Example:

      MyApp.statechart = SC.Statechart.create({
        rootSubstate: SC.Substate.design({
          initialSubstate: 'a',
          a: SC.Substate.plugin('path.to.a.state.class'),
          b: SC.Substate.plugin('path.to.another.state.class')
        })
      });

  You can also supply hashes the plugin feature in order to enhance a state or
  implement required functionality:

      SomeMixin = { ... };

      stateA: SC.Substate.plugin('path.to.state', SomeMixin, { ... })

  @param value {String} property path to a state class
  @param args {Hash,...} Optional. Hash objects to be added to the created state
*/
SC.Substate.plugin = function(value) {
  var args;

  // Fast arguments access.
  // Accessing `arguments.length` is just a Number and doesn't materialize the `arguments` object, which is costly.
  args = new Array(arguments.length - 1); // SC.A(arguments).shift()
  for (var i = 0, len = args.length; i < len; i++) { args[i] = arguments[i + 1]; }

  var func = function() {
    var klass = SC.objectForPropertyPath(value);
    if (!klass) {
      console.error('SC.Substate.plugin: Unable to determine path %@'.fmt(value));
      return undefined;
    }
    if (!klass.isClass || !klass.kindOf(SC.Substate)) {
      console.error('SC.Substate.plugin: Unable to extend. %@ must be a class extending from SC.Substate'.fmt(value));
      return undefined;
    }
    return klass.extend.apply(klass, args);
  };
  func.statePlugin = YES;
  return func;
};

SC.Substate.design = SC.Substate.extend;