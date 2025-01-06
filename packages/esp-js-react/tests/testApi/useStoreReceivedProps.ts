import {createContext, useContext} from 'react';

export const TestPropStoreContext = createContext<TestPropStore>(null);
export const useTestPropStore = () => useContext(TestPropStoreContext);

export class TestPropStore {
    receivedProps: any[] = [];
    pushProps(props: any) {
        this.receivedProps.push(props);
    }
    getLastProps(): any {
        return this.receivedProps[this.receivedProps.length -1];
    }
}