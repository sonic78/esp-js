import {Router, Logger} from 'esp-js';
import {PolimerModel} from 'esp-js-polimer';
import {TradingModuleContainerConst} from '../../tradingModuleContainerConst';
import {ViewFactoryBase, viewFactory, RegionRecordState} from 'esp-js-ui';
import {DynamicProductEvents} from './events';
import {AddProductFactoryEventTransforms, AddProductFactoryStateHandler, AddProductStateHandler, DynamicProductTileModel, DynamicProductTileModelBuilder} from './model';
import {Container} from 'esp-js-di';
import {DynamicProductTileView} from './views';
import {DynamicProductPersistedState} from './persistedState';
import {ProductCurrencyPairStateHandler} from './model/products/product/common/productCurrencyPairStateHandler';

const _log = Logger.create('DynamicProductTileViewFactory');

@viewFactory(TradingModuleContainerConst.dynamicProductsViewFactory, 'Dynamic Product Tile', 1)
export class DynamicProductTileViewFactory extends ViewFactoryBase<PolimerModel<DynamicProductTileModel>, { }> {
    private _router : Router;
    private _tileIdSeed = 1;

    constructor(container, router:Router) {
        super(container);
        this._router = router;
    }

    _createView(childContainer: Container, regionRecordState?: RegionRecordState<DynamicProductPersistedState>): PolimerModel<DynamicProductTileModel> {
        _log.verbose('Creating dynamic product tile model');

        const model = DynamicProductTileModelBuilder.createDefault(`sp-tile-${this._tileIdSeed++}`, regionRecordState.viewState);

        let polimerModel = this._router
            .modelBuilder<DynamicProductTileModel, DynamicProductPersistedState>()
            .withInitialModel(model)
            .enableReduxDevTools({
                // it's ok for small models to send the full model, if they get big it'll crash dev tools
                devToolsStateSelector: immutableModel => immutableModel,
                ignoredEvents: []
            })
            .withViewBindings(DynamicProductTileView)
            .withStateHandlers('addProduct', new AddProductStateHandler())
            // AddProductFactoryEventTransforms:
            // Event stream that expands the model by adding new products and their associated handlers.
            //
            // You can add handlers for specific parts of the model by providing a predicate to the below call.
            // See AddProductFactoryEventTransforms for examples of this done in a late bound manner.
            .withEventTransforms(new AddProductFactoryEventTransforms(model.modelId, this._router))
            // AddProductFactoryStateHandler:
            // Handler which processes events (from the above AddProductFactoryEventTransforms) to add new state to the model.
            // This handler acts on the entire Map<string, Product>.
            // This is just treating it like any other state handler, no special esp-js-polimer behavior.
            .withStateHandlers('products', new AddProductFactoryStateHandler())
            // ProductCurrencyPairStateHandler:
            // This is a narrower type of handler that works with instances of Product inside the specific Map<string, Product>, 'products'.
            // It's registered here and will apply to all products that get put in to the 'products' Map
            //
            // When publishing events to this handler, you should provide the entieyKey of the item in the map, i.e.:
            // router.publish({modelId, entityKey}, eventType, event);
            //
            // You can add handlers for specific entities by providing a predicate to the below call.
            // See AddProductFactoryEventTransforms for examples of this is done in a late bound manner.
            .withStateHandlers('products', new ProductCurrencyPairStateHandler())
            // Wire up a function to get persisted state.
            // When the page is reloaded, this state gets sent back into this view factory to rehydrate the view.
            .withStateSaveHandler((m: any) => this._saveState(m))
            .registerWithRouter();

        this._router.publishEvent(
            model.modelId,
            DynamicProductEvents.Bootstrapping.bootstrap,
            {
                // In some cases, you'd pass regionRecordState.viewState?.products to your default model builder, and re-hydrate state from it.
                // In this specific view, we are dynamically expanding the model, so we'll fire any product persisted state off in a bootstrap event.
                // This will force all 'add products to the model' logic to flow down the same paths.
                persistedProductStates: regionRecordState.viewState?.products
            } as DynamicProductEvents.Bootstrapping.BootstrapEvent
        );

        return polimerModel;
    }

    private _saveState(model: DynamicProductTileModel): DynamicProductPersistedState {
        // Save a flattened, minimal, view of the model.
        return {
            productTypeSelectorValue: model.addProduct.productTypeSelectorSelectedValue,
            products: Array.from(model.products.values()).map(product => ({
                productType: product.productType,
                ccyPairFieldValue: product.ccyPairField.ccyPair,
                swapPointsFieldValue: product.swapPointsField.swapPoints,
                barrier1FieldValue: product.barrier1.barrier,
                barrier2FieldValue: product.barrier2.barrier,
            }))
        };
    }
}