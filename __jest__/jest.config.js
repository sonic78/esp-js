module.exports = {
    "transform": {
        "^.+\\.[tj]sx?$": "<rootDir>/../../__jest__/typeScriptPreprocessor.ts"
    },
    "transformIgnorePatterns": ["<rootDir>/node_modules/"],
    "testMatch": [
        "**/tests/**/*Tests.[jt]s?(x)"
    ],
    "moduleFileExtensions": [
        "ts",
        "tsx",
        "js"
    ],
    "moduleNameMapper": {
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/../../__jest__/mocks/fileMock.js",
        "\\.(css|less)$": "<rootDir>/../../__jest__/mocks/styleMock.js"
    },
    "setupFiles": [
        "<rootDir>/../../__jest__/disableJestConsoleWrapper.js",
        "<rootDir>/../../__jest__/jest-fail-regression-fix.js",
    ],
    "modulePaths": [
        "<rootDir>"
    ],
    "//": "testEnvironment -> see -> https://testing-library.com/docs/react-testing-library/setup#jest-28",
    "testEnvironment": "jsdom",
    "testEnvironmentOptions": {
        "url": "http://localhost/",
    },
    "setupFilesAfterEnv": [
        "<rootDir>/../../__jest__/mocks/setupReactTestingLib.js"
    ]
};
