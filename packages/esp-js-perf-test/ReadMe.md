[![Build Status](https://travis-ci.org/esp/esp-js.svg?branch=master)](https://travis-ci.org/esp/esp-js)
![](https://img.shields.io/npm/types/esp-js)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)

# Evented State Processor (ESP) - Package esp-js-perf-test

ESP gives you the ability to manage changes to a model in a deterministic event driven manner.
It does this by adding specific processing workflow around changes to a model's state. 
It was born out of the need to manage complex UI and/or server state.

At its core is a `Router` which sits between event publishers and the model.
Those wanting to change the model publish events to the `Router`.
The model observes the events and applies the changes.
The model is then dispatched to model observers so new state can be applied.
It's lightweight, easy to apply and puts the model at the forefront of your design.

ESP 2.0 adds a host of other additional libraries to help you build composite single page application with React.
It allows you to use either OO, and/or immutable pattens (Redux like) for modeling independent and decoupled screens within your composite application.
Features include:

* The core event router - esp-js [![npm](https://img.shields.io/npm/v/esp-js.svg)](https://www.npmjs.com/package/esp-js) 
* Dependency injection container - esp-js-di [![npm](https://img.shields.io/npm/v/esp-js-di.svg)](https://www.npmjs.com/package/esp-js-di)
* Module loading system and composite application toolbox  - esp-js-ui [![npm](https://img.shields.io/npm/v/esp-js-ui.svg)](https://www.npmjs.com/package/esp-js-ui)
* React support - esp-js-react [![npm](https://img.shields.io/npm/v/esp-js-react.svg)](https://www.npmjs.com/package/esp-js-react)
* Immutable state models - esp-js-polimer [![npm](https://img.shields.io/npm/v/esp-js-polimer.svg)](https://www.npmjs.com/package/esp-js-polimer)   

It's built on typescript and type definitions are included in the npm packages.

For full documentation please see [https://esp.github.io/](https://esp.github.io/).