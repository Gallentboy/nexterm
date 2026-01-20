declare module 'streamsaver' {
    interface WritableStreamOptions {
        size?: number;
        pathname?: string;
        writableStrategy?: QueuingStrategy;
        readableStrategy?: QueuingStrategy;
    }

    interface StreamSaver {
        createWriteStream(filename: string, options?: WritableStreamOptions): WritableStream<Uint8Array>;
        WritableStream: typeof WritableStream;
        mitm: string;
    }

    const streamSaver: StreamSaver;
    export default streamSaver;
}
