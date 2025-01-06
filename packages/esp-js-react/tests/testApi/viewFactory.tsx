import {useTestPropStore} from './useStoreReceivedProps';
import * as React from 'react';

export const viewFactory = (name: string) => {
    return (props: { modelId?: string; value?: string, [key: string]: any }) => {
        let testPropStore = useTestPropStore();
        testPropStore.pushProps(props);
        return (
            <>
                <span data-testid='view-name'>{name}</span>
                <ViewMetadata modelId={props.modelId} modelValue={props.value} {...props}/>
            </>
        );
    };
};

export type ViewMetadataProps = {
    modelId: string,
    modelValue: string
    [key: string]: string; // ...rest props
};

export const ViewMetadata = (props: ViewMetadataProps) => {
    const { modelId, modelValue, ...rest} = props;
    return (
        <div>
            <span data-testid='modelIdDisplay'>{modelId}</span>
            <span data-testid='valueDisplay'>{modelValue}</span>
        </div>
    );
};