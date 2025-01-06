import {AppDefaultStateProvider, Level, Logger, LoggingConfig, ModelBase, StatefulRegion, SystemContainerConst, ViewFactoryBase} from 'esp-js-ui';
import {WorkspaceModel} from './views/workspace/model/workspaceModel';
import {ShellModuleContainerConst} from './shellModuleContainerConst';
import {RegionNames} from './regionNames';
import {Shell, Region} from 'esp-js-ui';
import {DefaultStateProvider} from '../defaultStateProvider';
import {AppPreferencesModel, AppPreferencesViewFactory} from './views';
import {EspDiConsts} from 'esp-js-di';
import * as uuid from 'uuid';

LoggingConfig.defaultLoggerConfig.level = Level.verbose;
LoggingConfig.defaultLoggerConfig.dumpAdditionalDetailsToConsole = true;

const _log = Logger.create('AppShell');

export class AppShell extends Shell {
    private _viewFactoryGroupId: string = uuid.v4();
    private _workspaceModelId: string;

    get workspaceModelId(): string {
        return this._workspaceModelId;
    }

    get stateSavingEnabled(): boolean {
        return true;
    }

    get stateSaveIntervalMs(): number {
        return 10_000;
    }

    getDefaultStateProvider(): AppDefaultStateProvider {
        return DefaultStateProvider;
    }

    get appStateKey() {
        return 'esp-demo-app-state';
    }

    configureContainer() {
        super.configureContainer();
        this.container
            .register(ShellModuleContainerConst.workspace_region, StatefulRegion)
            .inject(
                {resolver: 'literal', value: RegionNames.workspaceRegion},
                SystemContainerConst.router,
                SystemContainerConst.region_manager,
                SystemContainerConst.views_registry_model,
            )
            .singleton();
        this.container
            .register(ShellModuleContainerConst.blotter_region, StatefulRegion)
            .inject(
                {resolver: 'literal', value: RegionNames.blotterRegion},
                SystemContainerConst.router,
                SystemContainerConst.region_manager,
                SystemContainerConst.views_registry_model,
            )
            .singleton();
        this.container
            .register(ShellModuleContainerConst.modal_region, Region)
            .inject(
                {resolver: 'literal', value: RegionNames.modalRegion},
                SystemContainerConst.router,
                SystemContainerConst.region_manager,
                SystemContainerConst.views_registry_model,
            )
            .singleton();
        this.container
            .register(ShellModuleContainerConst.workspace_model, WorkspaceModel)
            .inject(
                SystemContainerConst.router,
                ShellModuleContainerConst.workspace_region,
                ShellModuleContainerConst.blotter_region,
                ShellModuleContainerConst.modal_region,
                ShellModuleContainerConst.app_preferences_view_factory,
                SystemContainerConst.state_service,
            );

        this.container
            .register(ShellModuleContainerConst.app_preferences_view_factory, AppPreferencesViewFactory)
            .inject(EspDiConsts.owningContainer, SystemContainerConst.router)
            .singleton()
            .inGroup(this._viewFactoryGroupId);
        this.container
            .register(ShellModuleContainerConst.app_preferences_model, AppPreferencesModel)
            .inject(
                {resolver: 'literal', value: this},
                SystemContainerConst.router,
                ShellModuleContainerConst.modal_region,
            )
            .transient(); // this gets recreated each time the screen is shown
    }

    start() {
        super.start();
        _log.verbose('Starting');
        let workspaceModel = this.container.resolve<WorkspaceModel>(ShellModuleContainerConst.workspace_model, this);
        workspaceModel.observeEvents();
        this._workspaceModelId = workspaceModel.modelId;
    }

    getViewFactories(): Array<ViewFactoryBase<ModelBase, any>> {
        return this.container.resolveGroup(this._viewFactoryGroupId);
    }
}