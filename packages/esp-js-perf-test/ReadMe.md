# Evented State Processor (ESP) - Package esp-js-perf-test

This package contains basic test runners that can be started and profiled.

## Build

```sh
yarn build-dev
````

# Run

```sh
node --inspect-brk ./.dist/esp-js-perf-test.js`
```

# Profile

Once the application is running, open your browser and navigate to [chrome://inspect/](chrome://inspect/).
You should see the previously started Node.js process waiting for attachment.
Profile it as you would any other Node.js application.


