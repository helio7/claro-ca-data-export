'use strict';
import { Request } from "express";
import { JwtPayload, verify } from 'jsonwebtoken';
import oracleDb, { Connection } from 'oracledb';
import { dbConfig } from "../db";

const logExecuteData: {
    body: any;
    headers: any;
    trailers: any;
    method: any;
    url: any;
    params: any;
    query: any;
    route: any;
    cookies: any;
    ip: any;
    path: any;
    host: any;
    fresh: any;
    stale: any;
    protocol: any;
    secure: any;
    originalUrl: any;
}[] = [];
const logData = (req: Request) => {
  logExecuteData.push({
    body: req.body,
    headers: req.headers,
    trailers: req.trailers,
    method: req.method,
    url: req.url,
    params: req.params,
    query: req.query,
    route: req.route,
    cookies: req.cookies,
    ip: req.ip,
    path: req.path,
    host: req.host,
    fresh: req.fresh,
    stale: req.stale,
    protocol: req.protocol,
    secure: req.secure,
    originalUrl: req.originalUrl
  });
}

interface DurationTimestampsPair {
    start: number | null;
    end: number | null;
}

const { JWT_SECRET } = process.env;

const execute = async function (req: Request, res: any) {
    console.log('Request arrived!');

    const { body } = req;

    if (!body) {
        console.error(new Error('invalid jwtdata'));
        return res.status(401).end();
    }
    if (!JWT_SECRET) {
        console.error(new Error('jwtSecret not provided'));
        return res.status(401).end();
    }

    console.log('Verifying...');

    verify(
        body.toString('utf8'),
        JWT_SECRET,
        { algorithms: ['HS256'], complete: false },
        async (err, decoded?: JwtPayload | string) => {
            if (err) {
                console.error(err);
                return res.status(401).end();
            }

            console.log('decoded:', decoded);

            if (
                !decoded
                || typeof decoded === 'string'
                || !decoded.inArguments
                || decoded.inArguments.length <= 0
            ) {
                console.error('inArguments invalid.');
                return res.status(400).end();
            }

            let tableName: string | null = null;
            let fields: string | null = null;
            for (const argument of decoded.inArguments) {
                if (argument.tableName) tableName = argument.tableName;
                else if (argument.fields) fields = argument.fields;
            }
            if (!tableName || !fields) return res.status(400).send('Input parameter is missing.');

            console.log('TABLE NAME:', tableName);
            console.log('UNPARSED FIELDS:', fields);

            const parsedFields = deserializeString(fields);
            console.log('PARSED FIELDS:', parsedFields);

            // Validate table name
            if (!isValidIdentifier(tableName)) {
                console.error('Invalid table name.');
                return res.status(200).send({ success: false });
            }

            // Validate all column names
            const columns = Object.keys(parsedFields);
            for (const col of columns) {
                if (!isValidIdentifier(col)) {
                    console.error(`Invalid column name (1st check): ${col}`);
                    return res.status(200).send({ success: false });
                }
            }

            try {
                const connection = await oracleDb.getConnection(dbConfig);

                const _tableExists = await tableExists(connection, 'users');
                if (!_tableExists) throw new Error('Table does not exist.');

                const columns = Object.keys(parsedFields);

                // Validate that all user-supplied column names exist in the table
                const validColumns = await getValidColumns(connection, tableName);
                for (const col of columns) {
                    if (!validColumns.includes(col.toUpperCase())) {
                        throw new Error(`Invalid column name (2nd check): ${col}`);
                    }
                }

                const bindParams = columns.map(col => `:${col}`);
                await connection.execute(
                    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${bindParams.join(', ')})`,
                    parsedFields,
                    { autoCommit: true },
                );
                await connection.close();
                return res.status(200).send({ success: true });
            } catch (err) {
                console.error(err);
                return res.status(200).send({ success: false });
            }
        },
    );
};

// Regex: Allow only alphanumeric, underscores, must start with a letter
const isValidIdentifier = (name: string) => /^[a-zA-Z][a-zA-Z0-9_]{0,29}$/.test(name);

async function getValidColumns(connection: Connection, tableName: string) {
    const result = await connection.execute(
      `SELECT column_name FROM all_tab_columns WHERE table_name = :table`,
      [tableName.toUpperCase()],
    );
    if (!result) throw new Error('Undefined result ("getValidColumns" function).');
    if (!result.rows) throw new Error('No rows ("getValidColumns" function).');
    return result.rows.map((row: any) => row[0]); // row[0] = column_name
}

async function tableExists(connection: Connection, tableName: string) {
    const result = await connection.execute(
      `SELECT table_name FROM all_tables WHERE table_name = :table`,
      [tableName.toUpperCase()]
    );
    if (!result) throw new Error('Undefined result ("tableExists" function).');
    if (!result.rows) throw new Error('No rows ("tableExists" function).');
    return result.rows.length > 0;
}

const edit = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Edit');
};

const save = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Save');
};

const publish = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Publish');
};

const validate = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Validate');
};

const stop = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Stop');
};

function millisToMinutesAndSeconds(millis: number): string {
    const minutes = Math.floor(millis / 60000);
    const seconds = ((millis % 60000) / 1000).toFixed(0);
    return Number(seconds) == 60 ? minutes + 1 + 'm' : minutes + 'm ' + (Number(seconds) < 10 ? '0' : '') + seconds + 's';
}

function specialConsoleLog(
    phoneNumber: string,
    eventName: string,
    durationTimestamps: DurationTimestampsPair,
    data: any,
    country: string,
): void {
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const currentTime = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

    const { start, end } = durationTimestamps;
    let duration = '-';
    if (start && end) duration = millisToMinutesAndSeconds(end - start);

    const jsonifiedData = JSON.stringify(data);

    console.log(`${todayDate}|${country}|${currentTime}|${phoneNumber}|${eventName}|${duration}|${jsonifiedData}`);
}

function deserializeString(str: string) {
    const result: {[fieldName: string]: string} = {};
    str.split(';').forEach(pair => {
        const [key, ...rest] = pair.split('=');
        result[key] = rest.join('='); // Handles '=' inside the value
    });
    return result;
}

export default {
    logExecuteData,
    execute,
    edit,
    save,
    publish,
    validate,
    stop,
};
