import {createImmutableModelUtility, ImmutableModelUtility} from '../src/immutableModelUtility';
import {StrictModeSettings, StrictMode} from '../src';

// This is only a shallow model.
// ImmutableModelUtility only deals with the top level reference, and it's immutability, not nested props
type TestState = {
    sumModelProps(): any;
    i2: number;
    i1: number;
};

describe('ImmutableModelUtility tests', () => {
    let initialState: TestState;
    let modelMutator: ImmutableModelUtility<TestState>;
    let expectedError = 'esp-js-polimer immutable model (id model-id1} accessed after change. You are likely closing over an old version of the model. This will cause issues as the model\'s state has since.';

    const createTestModel = (i1: number, i2: number) => {
        const model: TestState = {
            i1,
            i2,
            sumModelProps() {
                return this.i1 + this.i2;
            }
        };
        return model;
    };

    afterEach(() => {
        StrictModeSettings.setStrictMode('Off');
    });

    describe('StrictModeSettings.setStrictMode(Off)', () => {
        beforeEach(() => {
            StrictModeSettings.setStrictMode('Off');
            initialState = createTestModel(1, 2);
            modelMutator = createImmutableModelUtility('model-id1', initialState);
        });

        it('model is not proxied', () => {
            expect(modelMutator.model).toBe(initialState);
        });

        describe('Mutations', () => {
            let modelBeforeExpiration: TestState;
            let modelInstanceBeforeExpiration: TestState;

            beforeEach(() => {
                modelBeforeExpiration = {...modelMutator.model};
                modelInstanceBeforeExpiration = modelMutator.model;
                modelMutator.beginMutation();
            });

            it('props copied to draft', () => {
                expect(modelMutator.model).toEqual(modelInstanceBeforeExpiration);
                expect(modelMutator.model).not.toBe(modelInstanceBeforeExpiration)
            });

            it('old model still works, does not throw', () => {
                expect(() => {
                    modelInstanceBeforeExpiration.sumModelProps();
                }).not.toThrow();
                expect(() => {
                    modelInstanceBeforeExpiration.i1.toString();
                }).not.toThrow();
            });

            it('draft can be updated', () => {
                modelMutator.model.i1 = 10;
                modelMutator.model.i2 = 10;
                expect(modelMutator.model.sumModelProps()).toEqual(20);
            });

            it('changes to draft are tracked', () => {
                expect(modelMutator.hasChanges).toEqual(false);
                modelMutator.model.i1 = 10;
                expect(modelMutator.hasChanges).toEqual(true);
            });

            it('deletes changes to draft are tracked', () => {
                expect(modelMutator.hasChanges).toEqual(false);
                delete modelMutator.model.i1;
                expect(modelMutator.hasChanges).toEqual(true);
            });

            describe('endMutation()', () => {
                let draftBeforeEndMutation: TestState;
                let draftShallowCopyBeforeEndMutation: TestState;

                beforeEach(() => {
                    modelMutator.model.i1 = 10;
                    modelMutator.model.i2 = 10;
                    draftBeforeEndMutation = modelMutator.model;
                    // create a shallow copy so we can remove the proxy and later assert without it throwing an 'expired; error
                    draftShallowCopyBeforeEndMutation = { ...modelMutator.model };
                    modelMutator.endMutation();
                });

                it('props from draft copied to latest model', () => {
                    expect(modelMutator.model).not.toBe(draftBeforeEndMutation);
                    expect(modelMutator.model).toEqual(draftShallowCopyBeforeEndMutation);
                });

                it('updates model', () => {
                    expect(modelMutator.model.sumModelProps()).toEqual(20);
                });

                it('draft has changes is false', () => {
                    expect(modelMutator.hasChanges).toEqual(false);
                });
            });
        });
    });

    describe('StrictModeSettings.setStrictMode(ThrowError)', () => {
        beforeEach(() => {
            StrictModeSettings.setStrictMode('ThrowError');
            initialState = createTestModel(1, 2);
            modelMutator = createImmutableModelUtility('model-id1', initialState);
        });

        it('state is proxied', () => {
            expect(modelMutator.model).not.toBe(initialState);
        });

        it('props are accessible via proxy', () => {
            expect(modelMutator.model.i1).toEqual(1);
            expect(modelMutator.model.i2).toEqual(2);
        });

        it('functions are proxied', () => {
            expect(modelMutator.model.sumModelProps()).toEqual(3);
        });

        describe('Mutations', () => {
            let modelInstanceBeforeExpiration: TestState;

            beforeEach(() => {
                modelInstanceBeforeExpiration = modelMutator.model;
                modelMutator.beginMutation();
            });

            it('props copied to draft', () => {
                expect(modelMutator.model).not.toBe(modelInstanceBeforeExpiration);
                expect(modelMutator.model).toEqual(modelInstanceBeforeExpiration);
            });

            it('model marked as expired after mutation ends and prop access throws error', () => {
                modelMutator.model.i1 = 100;
                modelMutator.endMutation();

                expect(() => {
                    modelInstanceBeforeExpiration.sumModelProps();
                }).toThrow(expectedError);

                expect(() => {
                    modelInstanceBeforeExpiration.i1.toString();
                }).toThrow(expectedError);
            });

            it('model NOT marked as expired when there is no change', () => {
                modelMutator.endMutation();

                expect(() => {
                    modelInstanceBeforeExpiration.sumModelProps();
                }).not.toThrow();

                expect(() => {
                    modelInstanceBeforeExpiration.i1.toString();
                }).not.toThrow();
            });

            it('draft can be updated', () => {
                modelMutator.model.i1 = 10;
                modelMutator.model.i2 = 10;
                expect(modelMutator.model.sumModelProps()).toEqual(20);
            });

            it('setter changes to draft are tracked', () => {
                expect(modelMutator.hasChanges).toEqual(false);
                modelMutator.model.i1 = 10;
                expect(modelMutator.hasChanges).toEqual(true);
            });

            it('deletes changes to draft are tracked', () => {
                expect(modelMutator.hasChanges).toEqual(false);
                delete modelMutator.model.i1;
                expect(modelMutator.hasChanges).toEqual(true);
            });

            describe('endMutation()', () => {
                let draftBeforeEndMutation: TestState;
                let draftShallowCopyBeforeEndMutation: TestState;

                beforeEach(() => {
                    modelMutator.model.i1 = 10;
                    modelMutator.model.i2 = 10;
                    draftBeforeEndMutation = modelMutator.model;
                    // create a shallow copy so we can remove the proxy and later assert without it throwing an 'expired; error
                    draftShallowCopyBeforeEndMutation = { ...modelMutator.model };
                    modelMutator.endMutation();
                });

                it('props from draft copied to latest model', () => {
                    expect(modelMutator.model).not.toBe(draftBeforeEndMutation);
                    expect(modelMutator.model).toEqual(draftShallowCopyBeforeEndMutation);
                });

                it('updates model', () => {
                    expect(modelMutator.model.sumModelProps()).toEqual(20);
                });

                it('draft has changes is false', () => {
                    expect(modelMutator.hasChanges).toEqual(false);
                });
            });
        });
    });

    describe('StrictModeSettings.setStrictMode(WarnOnly)', () => {
        beforeEach(() => {
            StrictModeSettings.setStrictMode('WarnOnly');
        });

        it('does not throw when old model accessed', () => {
            initialState = createTestModel(1, 2);
            modelMutator = createImmutableModelUtility('model-id1', initialState);
            let oldModel = modelMutator.model;
            modelMutator.beginMutation();
            modelMutator.model.i1 = 30;
            modelMutator.model.i2 = 20;
            modelMutator.endMutation();
            expect(oldModel.sumModelProps()).toEqual(3);
            expect(modelMutator.model.sumModelProps()).toEqual(50);
        });
    });


    describe('Nested Proxies', () => {
        beforeEach(() => {
        });

        it('throws if proxy passed to createImmutableModelUtility', () => {
            StrictModeSettings.setStrictMode('ThrowError');
            initialState = createTestModel(1, 2);
            modelMutator = createImmutableModelUtility('model-id1', initialState);

            expect(() => {
                createImmutableModelUtility('model-id1', modelMutator.model);
            }).toThrow('The draftModel can not be a proxy');
        });
    });

    describe('Draft Replacement', () => {
        beforeEach(() => {
            StrictModeSettings.setStrictMode('ThrowError');
            modelMutator = createImmutableModelUtility('model-id1', initialState);
        });

        it('throws if utility  not in mutation mode', () => {
            let replacement = createTestModel(1, 2);
            expect(() => {
                modelMutator.replaceModel(replacement);
            }).toThrow(`Model model-id1 currently in draft/mutation mode. Can not replace.`);
        });

        it('can replace model', () => {
            modelMutator.beginMutation();
            expect(modelMutator.hasChanges).toEqual(false);
            expect(modelMutator.model.sumModelProps()).toEqual(3);
            modelMutator.replaceModel(createTestModel(10, 20));
            expect(modelMutator.hasChanges).toEqual(true);
            expect(modelMutator.model.i1).toEqual(10);
            expect(modelMutator.model.i2).toEqual(20);
            expect(modelMutator.model.sumModelProps()).toEqual(30);
            modelMutator.endMutation();
            expect(modelMutator.hasChanges).toEqual(false);
            expect(modelMutator.model.i1).toEqual(10);
            expect(modelMutator.model.i2).toEqual(20);
            expect(modelMutator.model.sumModelProps()).toEqual(30);
        });
    });

    describe('Proxy can be spread', () => {

        it('can ...spread model - non draft case ', () => {
            let utility = createImmutableModelUtility('model-id1', initialState);
            const modelCopy = {
                ...utility.model,
            };
            expect(utility.model).toEqual(modelCopy);
        });

        it('can ...spread model - draft case ', () => {
            let utility = createImmutableModelUtility('model-id1', initialState);
            utility.beginMutation();
            const modelCopy = {
                ...utility.model,
            };
            expect(utility.model).toEqual(modelCopy);
            utility.endMutation();
            expect(utility.model).toEqual(modelCopy);
        });
    });

    test.each([
        ['Off'],
        ['WarnOnly'],
        ['ThrowError'],
    ])('multiple mutation flow: %s', (strictMode: StrictMode) => {
        StrictModeSettings.setStrictMode(strictMode);

        initialState = createTestModel(1, 2);
        modelMutator = createImmutableModelUtility('model-id1', initialState);
        let modelV1 = modelMutator.model;

        modelMutator.beginMutation();
        modelMutator.model.i1 = 3;
        modelMutator.model.i2 = 4;
        modelMutator.endMutation();
        let modelV2 = modelMutator.model;

        modelMutator.beginMutation();
        modelMutator.model.i1 = 5;
        modelMutator.model.i2 = 6;
        modelMutator.endMutation();
        let modelV3 = modelMutator.model;

        if (strictMode === 'ThrowError') {
            expect(() => {
                modelV1.sumModelProps();
            }).toThrow(expectedError);
            expect(() => {
                modelV2.sumModelProps();
            }).toThrow(expectedError);
        } else {
            expect(modelV1.sumModelProps()).toEqual(3);
            expect(modelV2.sumModelProps()).toEqual(7);
        }
        expect(modelV3.sumModelProps()).toEqual(11);
    });
});