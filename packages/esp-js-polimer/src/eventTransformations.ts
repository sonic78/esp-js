import {EspDecoratorUtil, Guard, EspMetadata, ObservationStage, DecoratorTypes, EventContext, ModelAddress} from 'esp-js';
import {Observable} from 'rxjs';
import {EventEnvelopePredicate} from './eventEnvelopePredicate';

/**
 * A decorator which can be used to declare an event transformation handler
 */
export function eventTransformFor(eventType: string, observationStage = ObservationStage.final) {
    return function (target, name, descriptor) {
        Guard.stringIsNotEmpty(eventType, 'eventType passed to an eventTransformFor decorator must not be \'\'');
        let metadata: EspMetadata  = EspDecoratorUtil.getOrCreateMetaData(target.constructor);
        metadata.addEvent(
            name,
            eventType,
            DecoratorTypes.custom,
            observationStage,
            null
        );
        return descriptor;
    };
}

export interface InputEvent<TModel, TEvent, TEntity = unknown> {
    /**
     * The type of event.
     */
    readonly eventType: string;
    /**
     * The event published.
     */
    readonly event: TEvent;
    /**
     * The top level model the event was addressed to.
     * Note: this will be a Proxy, the same as PolimerModel.getEspPolimerImmutableModelProxy().
     * This allows for async event transform logic to close over a pointer to the latest model state.
     */
    readonly model: TModel;
    /**
     * Contextual information regarding the event publication.
     */
    readonly context: EventContext;
}

export type InputEventStream<TModel, TEvent, TEntity = unknown> = Observable<InputEvent<TModel, TEvent, TEntity>>;

export type OutputEvent<TEvent> = {
    readonly eventType: string;
    /**
     * @deprecated use address instead.
     * The modelId to publish the event to, if omitted, the current model's id will be used.
     */
    readonly modelId?: string;
    /**
     * The modelId (string) or ModelAddress to publish the event to.
     * Note, a partial (omitting modelId) ModelAddress can also be set.
     * If modelId is, omitted, the current model's id will be used.
     */
    readonly address?: string | ModelAddress;
    /**
     * The event being dispatched.
     */
    readonly event?: TEvent;
    /**
     * If true, the resultant event will be broadcast to all models.
     *
     * Don't overuse this as broadcast is an expensive operation.
     * Try to target specific models using their ID.
     */
    readonly broadcast?: boolean
};

export type OutputEventStream<TEvent> = Observable<OutputEvent<TEvent>>;

export interface EventTransformConfiguration {
    /**
     * An object containing @eventTransformFor decorated functions
     */
    eventTransform: object;
    /**
     * An optional predicate which will be queried to see if the event applies to the handler.
     */
    deliveryPredicate: EventEnvelopePredicate;
}