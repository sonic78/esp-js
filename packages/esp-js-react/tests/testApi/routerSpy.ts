import {Router, Observable} from 'esp-js';

export class RouterSpy extends Router {
    private _modelSubscriptionCountByModelId = new Map<string, number>();

    public getSubscriberCount(modelId: string) {
        return this._modelSubscriptionCountByModelId.get(modelId);
    }

    public getModelObservable<TModel>(modelId: string): Observable<TModel> {
        return Observable.create(o => {
            let c1 = this._modelSubscriptionCountByModelId.get(modelId) || 0;
            c1++;
            this._modelSubscriptionCountByModelId.set(modelId, c1);
            let subscription = super.getModelObservable(modelId).subscribe(o);
            return () => {
                let c2 = this._modelSubscriptionCountByModelId.get(modelId);
                c2--;
                this._modelSubscriptionCountByModelId.set(modelId, c2);
                subscription.dispose();
            };
        });
    }
}