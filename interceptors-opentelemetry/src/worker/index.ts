import { DefaultLogger, Worker, Core } from '@temporalio/worker';
import { OpenTelemetryDependencies } from '@temporalio/interceptors-opentelemetry/lib/workflow';
import {
  OpenTelemetryActivityInboundInterceptor,
  makeWorkflowExporter,
} from '@temporalio/interceptors-opentelemetry/lib/worker';
import { setupOpentelemetry } from './setup';
import * as activities from '../activities';

async function main() {
  const otel = await setupOpentelemetry();

  Core.install({
    // Silence the Worker logs to better see the span output
    logger: new DefaultLogger('WARNING'),
  });

  // Worker connects to localhost by default and uses console error for logging.
  // Customize the Worker by passing more options to create().
  // create() tries to connect to the server and will throw if a connection could not be established.
  // You may create multiple Workers in a single process in order to poll on multiple task queues.
  // In order to configure the server connection parameters and other global options,
  // use the Core.install() method to configure the Rust Core SDK singleton.
  const worker = await Worker.create<{ dependencies: OpenTelemetryDependencies }>({
    workflowsPath: require.resolve('../workflows'),
    activities,
    taskQueue: 'interceptors-opentelemetry-example',
    dependencies: {
      exporter: makeWorkflowExporter(otel.exporter),
    },
    // Registers opentelemetry interceptors for Workflow and Activity calls
    interceptors: {
      workflowModules: [require.resolve('../workflows')], // example contains both workflow and interceptors
      activityInbound: [() => new OpenTelemetryActivityInboundInterceptor()],
    },
  });
  await worker.run();
  await otel.sdk.shutdown();
}

main().then(
  () => void process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
