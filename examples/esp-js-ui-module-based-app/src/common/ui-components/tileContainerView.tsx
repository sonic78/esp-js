import * as classnames from 'classnames';
import * as React from 'react';
import './tileContainerView.css';

export type TileContainerViewProps = React.PropsWithChildren<{
    title: string;
    modelId: string;
    classNames?: any;
}>;

export const TileContainerView: React.FC<TileContainerViewProps> = ({title, modelId, classNames, children}) => {
    return (
        <div className={classnames('tileViewContainer', classNames)}>
            <div className='header'>{title}</div>
            <div className='modelId'>id: {modelId}</div>
            {children}
        </div>
    );
};