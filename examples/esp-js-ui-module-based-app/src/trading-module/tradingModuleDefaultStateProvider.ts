import * as uuid from 'uuid';
import * as _ from 'lodash';
import {DefaultStateProvider, ViewFactoryState} from 'esp-js-ui';
import {RegionNames} from '../shell/regionNames';
import {BlotterState} from './blotter/models/blotterState';
import {TradingModuleContainerConst} from './tradingModuleContainerConst';
import {CashTileModel, defaultModelFactory} from './cash-tile/model/cashTileModel';

export class TradingModuleDefaultStateProvider implements DefaultStateProvider {
    getViewFactoriesState(layoutMode: string): Array<ViewFactoryState> {
        let blotterStates = [BlotterState.create(RegionNames.blotterRegion)];
        let cashTileModels: Array<CashTileModel> = _.map(
            ['EURUSD', 'EURGBP', 'AUDUSD', 'CADJPY'],
            symbol => defaultModelFactory(uuid.v4(), symbol)
        );
        return [{
            viewFactoryKey: TradingModuleContainerConst.blotterViewFactory,
            state: blotterStates
        }, {
            viewFactoryKey: TradingModuleContainerConst.cashTileViewFactory,
            state: cashTileModels
        }];
    }
}
