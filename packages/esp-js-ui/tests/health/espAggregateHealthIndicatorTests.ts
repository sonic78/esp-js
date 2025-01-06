import {EspAggregateHealthIndicator} from '../../src/health/';
import {Health, HealthIndicator, HealthStatus} from 'esp-js';
import {Container} from 'esp-js-di';
import {MetricFactoryImplementation} from 'esp-js-metrics';
import {TestMetricFactory} from './testMetrics';

class TestHealthIndicator implements HealthIndicator {
    constructor(public healthIndicatorName: string) {
    }

    public currentHealth: Health;
    public health(): Health {
        return this.currentHealth;
    }
    public setStatus(status: HealthStatus) {
        this.currentHealth = Health.builder(this.healthIndicatorName).setStatus(status).build();
    }
}

describe('EspAggregateHealthIndicator Tests', () => {
    let updates = 0;
    let aggregateIndicator: EspAggregateHealthIndicator = null;
    let container: Container;
    let testMetricFactory: TestMetricFactory;

    beforeAll(() => {
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');
    });

    beforeEach(() => {
        jest.clearAllTimers();
        testMetricFactory = new TestMetricFactory();
        MetricFactoryImplementation.set(testMetricFactory);
        updates = 0;
        container = new Container();
        aggregateIndicator = new EspAggregateHealthIndicator(container);
        aggregateIndicator.start();
    });

    afterAll(() => {
        MetricFactoryImplementation.unset();
        jest.useRealTimers();
    });

    it('adds indicator when registered', () => {
        container.registerInstance('indicator1-key', new TestHealthIndicator('indicator1'));
        expect(aggregateIndicator.activateIndicatorCount).toEqual(1);
    });

    it('adds indicator when resolved', () => {
        container
            .register('indicator1-key', TestHealthIndicator)
            .inject({resolver: 'literal', value: 'indicator1'})
            .singleton();
        expect(aggregateIndicator.activateIndicatorCount).toEqual(0);
        let indicator1 = container.resolve<TestHealthIndicator>('indicator1-key');
        container.resolve<TestHealthIndicator>('indicator1-key');
        expect(aggregateIndicator.activateIndicatorCount).toEqual(1);
    });

    it('indicators take part in health', () => {
        container
            .register('indicator-transient-key', TestHealthIndicator)
            .transient();
        container
            .register('indicator-singleton-key', TestHealthIndicator)
            .inject({resolver: 'literal', value: 'indicator-singleton'})
            .singleton();

        moveTimeAndAssertHealth(HealthStatus.Unknown, 0);

        let indicator1 = container.resolve<TestHealthIndicator>('indicator-singleton-key');
        indicator1.setStatus(HealthStatus.Healthy);
        moveTimeAndAssertHealth(HealthStatus.Healthy, 1);

        let indicator2 = container.resolve<TestHealthIndicator>('indicator-transient-key', 'indicator2');
        indicator2.setStatus(HealthStatus.Unhealthy);
        moveTimeAndAssertHealth(HealthStatus.Unhealthy, 2);

        let indicator3 = container.resolve<TestHealthIndicator>('indicator-transient-key', 'indicator3');
        indicator3.setStatus(HealthStatus.Unknown);
        moveTimeAndAssertHealth(HealthStatus.Unknown, 3);

        indicator1.setStatus(HealthStatus.Healthy);
        indicator2.setStatus(HealthStatus.Healthy);
        indicator3.setStatus(HealthStatus.Healthy);
        moveTimeAndAssertHealth(HealthStatus.Healthy, 3);
    });

    it('health metric changes when health changes', () => {
        let indicator = new TestHealthIndicator('i1');
        let metric = testMetricFactory.metricsByName.get('esp_aggregate_health');
        indicator.setStatus(HealthStatus.Healthy);
        container.registerInstance('indicator1-key', indicator);

        moveTimeAndAssertHealth(HealthStatus.Healthy, 1);
        expect(metric.setCalls.length).toEqual(1);
        expect(metric.setCalls[0][0]).toEqual(1); // healthy

        indicator.setStatus(HealthStatus.Unhealthy);
        moveTimeAndAssertHealth(HealthStatus.Unhealthy, 1);
        expect(metric.setCalls.length).toEqual(2);
        expect(metric.setCalls[1][0]).toEqual(0); // unhealthy

        indicator.setStatus(HealthStatus.Unknown);
        moveTimeAndAssertHealth(HealthStatus.Unknown, 1);
        expect(metric.setCalls.length).toEqual(3);
        expect(metric.setCalls[2][0]).toEqual(-1); // Unknown
    });

    const moveTimeAndAssertHealth = (expected: HealthStatus, expectedIndicatorCount: number) => {
        jest.advanceTimersByTime(5000);
        expect(aggregateIndicator.activateIndicatorCount).toEqual(expectedIndicatorCount);
        expect(aggregateIndicator.health().status).toEqual(expected);
    };
});
