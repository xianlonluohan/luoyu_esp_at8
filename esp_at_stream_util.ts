namespace emakefun {
    let g_received_buffer = Buffer.create(0);

    /**
     * Simultaneously search for multiple target strings in a serial data stream.
     * @param targets The target string array to be searched for.
    * @param timeout_ms Timeout for waiting for response (milliseconds).
     * @returns Find the index of the target string in the array, return -1 if not found.
     */
    export function multiFindUtil(targets: string[], timeout_ms: number): number {
        if (!targets || targets.length == 0 || timeout_ms < 0) {
            throw "Error: 'multiFindUtil' function, invalid parameters.";
        }
        const byte_targets = targets.map(t => Buffer.fromUTF8(t));
        let offsets: number[] = [];
        for (let i = 0; i < byte_targets.length; i++) {
            offsets.push(0);
        }
        const end_time = input.runningTime() + timeout_ms;
        do {
            let data = serial.readBuffer(0);
            if (g_received_buffer.length > 0) {
                data = g_received_buffer.concat(data);
                g_received_buffer = Buffer.create(0)
            }

            for (let i = 0; i < data.length; i++) {
                for (let j = 0; j < byte_targets.length; j++) {
                    const byte_target = byte_targets[j];
                    let offset = offsets[j];

                    if (data[i] == byte_target[offset]) {
                        offset += 1;
                        if (offset == byte_target.length) {
                            g_received_buffer = data.slice(i + 1);
                            return j;
                        }
                        offsets[j] = offset;
                        continue;
                    }
                    if (offset == 0) {
                        continue
                    }
                    const original_offset = offset
                    while (offset > 0) {
                        offset -= 1;
                        if (data[i] != byte_target[offset]) {
                            continue;
                        }
                        if (offset == 0) {
                            offset += 1;
                            break;
                        }
                        const offset_diff = original_offset - offset;
                        let k = 0;
                        for (k = 0; k < offset; k++) {
                            if (byte_target[k] != byte_target[k + offset_diff]) {
                                break;
                            }
                        }
                        if (k == offset) {
                            offset += 1;
                            break;
                        }
                    }
                }
            }
        } while (input.runningTime() < end_time);
        return NaN;
    }

    /**
     * Search for a single target string in the serial data stream.
     * @param target The target string to be searched for.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     * @returns Whether the target string has been found, true: found, false: not found.
     */
    export function singleFindUtil(target: string, timeout_ms: number): boolean {
        if (!target || timeout_ms < 0) {
            throw "Error: 'singleFindUtil' function, invalid parameters.";
        }
        let byte_target = Buffer.fromUTF8(target)
        let offset = 0;

        const end_time = input.runningTime() + timeout_ms;
        do {
            let data = serial.readBuffer(0);
            if (g_received_buffer.length > 0) {
                data = g_received_buffer.concat(data);
                g_received_buffer = Buffer.create(0)
            }
            for (let i = 0; i < data.length; i++) {
                if (data[i] == byte_target[offset]) {
                    offset += 1;
                    if (offset == byte_target.length) {
                        g_received_buffer = data.slice(i + 1);
                        return true
                    };
                    continue
                }

                const original_offset = offset
                while (offset > 0) {
                    offset -= 1;
                    if (data[i] != byte_target[offset]) {
                        continue;
                    }
                    if (offset == 0) {
                        offset += 1;
                        break;
                    }
                    const offset_diff = original_offset - offset
                    let k = 0;
                    for (k = 0; k < offset; k++) {
                        if (byte_target[k] != byte_target[k + offset_diff]) {
                            break;
                        }
                    }
                    if (k == offset) {
                        offset += 1;
                        break;
                    }
                }
            }
        } while (input.runningTime() < end_time);
        return false;
    }

    /**
     * Skip the next character and return true if it matches the target character.
     * @param target Target characters.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     * @returns Match and skip target characters, true: successful, false: failed.
     */
    export function skipNext(target: string, timeout_ms: number): boolean {
        if (!target || target.length != 1 || timeout_ms < 0) {
            throw "Error: 'skipNext' function, invalid parameters.";
        }

        const target_byte = Buffer.fromUTF8(target)[0];
        const end_time = input.runningTime() + timeout_ms;

        let read_byte: number;

        if (g_received_buffer.length > 0) {
            read_byte = g_received_buffer[0];
            g_received_buffer = g_received_buffer.slice(1);
            return read_byte == target_byte;
        }

        do {
            const data = serial.readBuffer(0);
            if (data.length > 0) {
                read_byte = data[0];
                if (data.length > 1) {
                    g_received_buffer = data.slice(1);
                }
                return read_byte == target_byte;
            }
        } while (input.runningTime() < end_time);
        return false;

    }

    /**
     * Parse integers from serial data streams.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     * @returns The parsed integer value returns -1 upon timeout or failure.
     */
    export function parseNumber(timeout_ms: number): number {
        if (timeout_ms < 0) {
            throw "Error: 'parseNumber' function, invalid parameters.";
        }
        const end_time = input.runningTime() + timeout_ms;
        let num_str = "";
        do {
            let data = serial.readBuffer(0);
            if (g_received_buffer.length > 0) {
                data = g_received_buffer.concat(data);
                g_received_buffer = Buffer.create(0);
            }
            for (let i = 0; i < data.length; i++) {
                const read_char = String.fromCharCode(data[i]);

                if ((read_char == "-" && num_str == "") || ("0" <= read_char && read_char <= "9")) {
                    num_str += read_char;
                } else {
                    g_received_buffer = data.slice(i + 1);
                    if (num_str != "" && num_str != "-") {
                        return parseInt(num_str);
                    }
                    return NaN;
                }
            }
        } while (input.runningTime() < end_time);
        return NaN;
    }

    /**
     * Read from serial until delimiter is found.
     * @param delimiter The delimiter character.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     * @returns The read string until delimiter, or null if timeout.
     */
    export function readUntil(delimiter: string, timeout_ms: number): string {
        if (!delimiter || delimiter.length !== 1 || timeout_ms < 0) {
            throw "Error: 'readUntil' function, invalid parameters.";
        }

        const delimiter_byte = Buffer.fromUTF8(delimiter)[0];
        const end_time = input.runningTime() + timeout_ms;
        let result_buffer = Buffer.create(0);

        do {
            let data = serial.readBuffer(0);
            if (g_received_buffer.length > 0) {
                data = g_received_buffer.concat(data);
                g_received_buffer = Buffer.create(0);
            }
            for (let i = 0; i < data.length; i++) {
                if (data[i] == delimiter_byte) {
                    g_received_buffer = data.slice(i + 1);
                    result_buffer = result_buffer.concat(data.slice(0, i))
                    return result_buffer.toString();
                }
            }
            result_buffer = result_buffer.concat(data);
        } while (input.runningTime() < end_time);
        return null;

    }

    /**
    * Read data of specified length
    * @param length The length of the data to be read
    * @param timeout_ms Timeout for waiting for response (milliseconds).
    * @returns Read data, return null if timeout or insufficient data
    */
    export function readBytes(length: number, timeout_ms: number): Buffer {
        if (length <= 0 || timeout_ms < 0) {
            return null;
        }
        let result_buffer = g_received_buffer;
        let result_length = result_buffer.length;
        g_received_buffer = Buffer.create(0);

        if (result_length < length) {
            const end_time = input.runningTime() + timeout_ms;
            do {
                const data = serial.readBuffer(0);
                if (data.length > 0) {
                    result_buffer = result_buffer.concat(data);
                    result_length += data.length;
                }
            } while (result_length < length && input.runningTime() < end_time);
        }

        if (result_length > length) {
            g_received_buffer = result_buffer.slice(length + 1);
            result_buffer = result_buffer.slice(0, length);
        } else if (result_length < length) {
            return null;
        }

        return result_buffer;
    }

}