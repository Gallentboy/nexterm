declare module 'zmodem.js/src/zmodem_browser' {
    export class Sentry {
        constructor(options: {
            to_terminal: (octets: ArrayLike<number>) => void;
            sender: (octets: ArrayLike<number>) => void;
            on_retract?: () => void;
            on_detect?: (detection: any) => void;
        });
        consume(data: ArrayBuffer | Uint8Array): void;
        get_confirmed_session(): any;
    }

    export namespace Browser {
        function send_files(
            session: any,
            files: Array<{ name: string; size: number; mtime: Date; data: Uint8Array }>,
            options: {
                on_offer_response?: (_obj: any, xfer: any) => void;
                on_progress?: (_obj: any, _xfer: any) => void;
                on_file_complete?: (_obj: any) => void;
            }
        ): Promise<void>;
    }
}
