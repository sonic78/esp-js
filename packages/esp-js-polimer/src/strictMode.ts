export type StrictMode = 'Off' | 'WarnOnly' | 'ThrowError';

let _strictModeOn: StrictMode = 'Off';

export const StrictModeSettings = {
    setStrictMode: (strictMode: StrictMode) => {
        _strictModeOn = strictMode;
    },
    getStrictMode() {
        return _strictModeOn;
    },
    modeIsOff() {
        return _strictModeOn === 'Off';
    },
    modeIsWarn() {
        return _strictModeOn === 'WarnOnly';
    },
    modeIsThrowError() {
        return _strictModeOn === 'ThrowError';
    },
};
