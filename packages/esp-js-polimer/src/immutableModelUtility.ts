import {StrictModeSettings} from './strictMode';
import {logger} from './logger';
import { Guard } from 'esp-js';

const isExpireableModelProxy = Symbol('__isProxy__');

type ExpirableModelProxy<TModel> = {
    model: TModel,
    setExpired: () => void
};
/**
 * If strict mode is enabled, this will wrap the draftModel in a proxy which we can later 'expire'.
 * When 'expired', depending on StrictModeSettings settings, model access may result in an error or warning.
 */
const createExpireableModelProxy =  <TModel>(modelId: string, draftModel: TModel): ExpirableModelProxy<TModel> => {
    Guard.isFalsey(draftModel[isExpireableModelProxy], 'The draftModel can not be a proxy');
    let expired = false;
    const traps = {
        get(target: any, prop: any) {
            if (prop === isExpireableModelProxy) {
                return true;
            }
            if (expired) {
                tryThrowOrWarnIfModelExpired(modelId);
            }
            return target[prop];
        },
        set(target:any, prop: any) {
            throw new Error(`Can not set prop ${prop} on readonly model ${modelId}`);
        },
        ownKeys(target: any) {
            return Object.keys(target);
        },
        getOwnPropertyDescriptor(target: any, prop: any) {
            return Object.getOwnPropertyDescriptor(target, prop);
        }
    };
    const model = StrictModeSettings.modeIsOff()
        ? draftModel
        : new Proxy(draftModel, traps);
    return {
        get model() {
            return model;
        },
        setExpired() {
            expired = true;
        },
    };
};

type DraftableModelProxy<TModel> = {
    /**
     * Proxy implementing change tracking
     */
    draftProxy: TModel,
    /**
     * Underlying model being tracked
     */
    draftModel: TModel,
    readonly hasChanges: boolean;
    setExpired: () => void;
};

const createDraftableModelProxy = <TModel>(modelId: string, baseModel: TModel, defaultHasChanges = false): DraftableModelProxy<TModel> => {
    let hasChanges = defaultHasChanges;
    let expired = false;
    const draftModel = {
        ...baseModel
    };
    const traps = {
        get(target: any, prop: any) {
            if (expired) {
                throw new Error(`Draft copy has expired. ModelID: ${modelId}`);
            }
            return target[prop];
        },
        set(target: any, prop: any, value: any) {
            hasChanges = true;
            target[prop] = value;
            return target;
        },
        deleteProperty(target: any, prop: string) {
            if (!(prop in target)) {
                return false;
            }
            hasChanges = true;
            delete target[prop];
            return target;
        },
        ownKeys(target: any) {
            return Object.keys(target);
        },
        getOwnPropertyDescriptor(target: any, prop: any) {
            return Object.getOwnPropertyDescriptor(target, prop);
        }
    };
    return {
        draftProxy: new Proxy(draftModel, traps),
        draftModel: draftModel,
        get hasChanges() {
            return hasChanges;
        },
        setExpired() {
            expired = true;
        },
    };
};

export type ImmutableModelUtility<TModel> = {
    readonly model: TModel;
    readonly modelProxy: TModel;
    readonly hasChanges: boolean;
    beginMutation(): void
    replaceModel(other: TModel): void
    endMutation(): void;
};

/**
 * Creates a utility object which helps manage mutations to an underlying model.
 *
 * This has support for StrictModeSettings whereby when that's on, it will cause cached versions of old/expired models to throw or warn if accessed.
 */
export const createImmutableModelUtility = <TModel>(modelId: string, initialDraft: TModel): ImmutableModelUtility<TModel> => {
    let expireableModel: ExpirableModelProxy<TModel> = createExpireableModelProxy<TModel>(modelId, initialDraft);
    let draftableModel: DraftableModelProxy<TModel> = null;
    // modelProxy: a non changing instance which always backs onto latest state, be it the draft or the model.
    const getCurrentModel = () => {
        if (draftableModel) {
            // we expose draftProxy, not draftModel, so we can track changes to it.
            return draftableModel.draftProxy;
        }
        return expireableModel.model;
    };
    const modelProxy = new Proxy({}, {
        get(target: any, prop: any) {
            const current = getCurrentModel();
            return current[prop];
        },
        ownKeys(target: any) {
            const current = getCurrentModel();
            return Object.keys(current);
        },
        getOwnPropertyDescriptor(target: any, prop: any) {
            const current = getCurrentModel();
            return Object.getOwnPropertyDescriptor(current, prop);
        }
    });
    return {
        get model() {
            if (draftableModel) {
                // we expose draftProxy, not draftModel, so we can track changes to it.
                return draftableModel.draftProxy;
            }
            return expireableModel.model;
        },
        get modelProxy() {
            return modelProxy;
        },
        get hasChanges() {
            return draftableModel ? draftableModel.hasChanges : false;
        },
        beginMutation() {
            draftableModel = createDraftableModelProxy(modelId, expireableModel.model);
        },
        replaceModel(other: TModel) {
            if (!draftableModel) {
                throw new Error(`Model ${modelId} currently in draft/mutation mode. Can not replace.`);
            }
            draftableModel = createDraftableModelProxy(modelId, other, true);
        },
        endMutation() {
            if (draftableModel.hasChanges) {
                expireableModel.setExpired();
                // we create the next expireableModel using draftModel, not draftProxy, we can expire the draft proxy now.
                expireableModel = createExpireableModelProxy(modelId, draftableModel.draftModel);
            }
            draftableModel.setExpired();
            draftableModel = null;
        }
    };
};

const tryThrowOrWarnIfModelExpired = (modelId: string) => {
    if (StrictModeSettings.modeIsOff()) {
        return;
    }
    const errorMessage = `esp-js-polimer immutable model (id ${modelId}} accessed after change. You are likely closing over an old version of the model. This will cause issues as the model's state has since.`;
    if (StrictModeSettings.modeIsThrowError()) {
        throw new Error(errorMessage);
    }
    if (StrictModeSettings.modeIsWarn()) {
        let stack: string | undefined = undefined;
        try {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error();
        } catch (e) {
            stack = (e as Error).stack;
        }
        logger.warn(`${errorMessage} Stack: ${stack}`);
    }
};
