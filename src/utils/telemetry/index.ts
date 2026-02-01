import {
  NodeTracerProvider,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  SpanProcessor
} from '@opentelemetry/sdk-trace-node';
import {
  TraceIdRatioBasedSampler
} from '@opentelemetry/sdk-trace-base';
import {
  resourceFromAttributes
} from '@opentelemetry/resources';
import {
  OTLPTraceExporter
} from '@opentelemetry/exporter-trace-otlp-http';
import {
  JaegerExporter
} from '@opentelemetry/exporter-jaeger';
import {
  ZipkinExporter
} from '@opentelemetry/exporter-zipkin';
import {
  SemanticResourceAttributes
} from '@opentelemetry/semantic-conventions';
import {
  registerInstrumentations
} from '@opentelemetry/instrumentation';
import {
  HttpInstrumentation
} from '@opentelemetry/instrumentation-http';
import {
  FastifyInstrumentation
} from '@opentelemetry/instrumentation-fastify';
import type { SystemConfig } from '../../config/config.schema.js';
import { logger } from '../logger.js';

/**
 * OpenTelemetry Tracing Configuration and Initialization
 */
export class TelemetryManager {
  private static instance: TelemetryManager;
  private provider: any | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
  }

  /**
   * Initialize OpenTelemetry tracing based on configuration
   * @param config System configuration with observability settings
   */
  public initialize(config: SystemConfig): void {
    if (this.isInitialized) {
      logger.warn('Telemetry already initialized, skipping initialization');
      return;
    }

    const tracingConfig = config.observability?.tracing;
    if (!tracingConfig?.enabled) {
      logger.info('OpenTelemetry tracing disabled in configuration');
      return;
    }

    try {
      // Create resource with service information
      const resource = resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: 'mcp-hub-lite',
        [SemanticResourceAttributes.SERVICE_VERSION]: config.version,
        [SemanticResourceAttributes.HOST_NAME]: config.system.host,
        [SemanticResourceAttributes.PROCESS_PID]: process.pid
      });

      const providerOptions = {
        resource,
        sampler: new TraceIdRatioBasedSampler(tracingConfig.sampleRate)
      };

      this.provider = new NodeTracerProvider(providerOptions);

      // Create and configure span processor based on exporter type
      const spanProcessor = this.createSpanProcessor(tracingConfig);
      this.provider.addSpanProcessor(spanProcessor);

      // Register the provider globally
      this.provider.register();

      // Register automatic instrumentations
      this.registerInstrumentations();

      this.isInitialized = true;
      logger.info(`OpenTelemetry tracing initialized with ${tracingConfig.exporter} exporter`);
    } catch (error) {
      logger.error('Failed to initialize OpenTelemetry tracing:', error);
    }
  }

  /**
   * Create span processor based on exporter configuration
   */
  private createSpanProcessor(tracingConfig: SystemConfig['observability']['tracing']): SpanProcessor {
    let exporter;

    switch (tracingConfig.exporter) {
      case 'otlp':
        exporter = new OTLPTraceExporter({
          url: tracingConfig.endpoint
        });
        break;
      case 'jaeger':
        exporter = new JaegerExporter({
          endpoint: tracingConfig.endpoint
        });
        break;
      case 'zipkin':
        exporter = new ZipkinExporter({
          url: tracingConfig.endpoint
        });
        break;
      case 'console':
      default:
        exporter = new ConsoleSpanExporter();
    }

    return new SimpleSpanProcessor(exporter);
  }

  /**
   * Register automatic instrumentations for HTTP and Fastify
   */
  private registerInstrumentations(): void {
    try {
      registerInstrumentations({
        instrumentations: [
          new HttpInstrumentation(),
          new FastifyInstrumentation()
        ]
      });
      logger.debug('OpenTelemetry automatic instrumentations registered');
    } catch (error) {
      logger.warn('Failed to register OpenTelemetry instrumentations:', error);
    }
  }

  /**
   * Shutdown OpenTelemetry provider gracefully
   */
  public async shutdown(): Promise<void> {
    if (this.provider && this.isInitialized) {
      try {
        await this.provider.shutdown();
        this.isInitialized = false;
        logger.info('OpenTelemetry tracing shutdown completed');
      } catch (error) {
        logger.error('Failed to shutdown OpenTelemetry tracing:', error);
      }
    }
  }

  /**
   * Check if telemetry is initialized and enabled
   */
  public isEnabled(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const telemetryManager = TelemetryManager.getInstance();

export { withSpan, withSpanSync, createMcpSpanOptions } from './helpers.js';