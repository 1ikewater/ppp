import { createServer } from 'http';
import { Client as SSHClient } from './salt/states/ppp/lib/ssh2/index.js';
import { fetch, binaryFetch } from './salt/states/ppp/lib/fetch.mjs';
import { Connection } from './salt/states/ppp/lib/pg/connection.mjs';
import Redis from './salt/states/ppp/lib/vendor/ioredis.min.js';
import pdfjs from './salt/states/ppp/lib/pdfjs/legacy/build/pdf.js';

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

async function $fetch(request, response) {
  const buffers = [];

  for await (const chunk of request) {
    buffers.push(chunk);
  }

  try {
    const body = JSON.parse(Buffer.concat(buffers).toString());
    const headers = body.headers ?? {};

    if (!headers['User-Agent']) {
      headers['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';
    }

    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const requestOptions = {
      method: body.method?.toUpperCase() ?? request.method.toUpperCase(),
      headers
    };

    if (typeof body.body === 'string') {
      requestOptions.body = body.body;
    } else if (typeof body.body === 'object')
      requestOptions.body = JSON.stringify(body.body);

    if (
      requestOptions.body &&
      typeof requestOptions.headers['Content-Length'] === 'undefined'
    )
      requestOptions.headers['Content-Length'] = Buffer.byteLength(
        requestOptions.body
      );

    const fetchResponse = await fetch(body.url, requestOptions);
    const ct = fetchResponse.headers['content-type'];

    if (ct) response.setHeader('Content-Type', ct);

    response.writeHead(fetchResponse.status);
    response.write(fetchResponse.responseText);
    response.end();
  } catch (e) {
    console.error(e);

    response.setHeader('Content-Type', 'application/json; charset=UTF-8');
    response.writeHead(400);
    response.write(
      JSON.stringify({
        error: {
          message: e.message
        }
      })
    );
    response.end();
  }
}

async function pdf(request, response) {
  if (!/post/i.test(request.method)) {
    return response.writeHead(405).end();
  }

  const buffers = [];

  for await (const chunk of request) {
    buffers.push(chunk);
  }

  response.setHeader('Content-Type', 'application/json; charset=UTF-8');

  try {
    const body = JSON.parse(Buffer.concat(buffers).toString());

    if (!body.pdfFile || typeof body.pdfFile !== 'string')
      return response.writeHead(422).end();

    // { keyName: itemIndex }
    if (!body.items || typeof body.items !== 'object')
      return response.writeHead(422).end();

    if (!body.page || typeof body.page !== 'number')
      return response.writeHead(422).end();

    let data;

    if (body.pdfFile.startsWith('http')) {
      data = new Uint8Array(
        Buffer.from(
          (
            await binaryFetch(body.pdfFile, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36'
              }
            })
          ).chunks
        ).buffer
      );
    } else {
      data = new Uint8Array(Buffer.from(body.pdfFile, 'base64').buffer);
    }

    const loadingTask = pdfjs.getDocument({
      data,
      cMapUrl: './ppp-dyno/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: './ppp-dyno/pdfjs/standard_fonts/'
    });
    const pdfDocument = await loadingTask.promise;
    const result = {};

    if (pdfDocument?.numPages >= body.page) {
      const page = await pdfDocument.getPage(body.page);
      const text = await page?.getTextContent();
      const items = text?.items?.filter((i) => i.str?.trim().length);

      for (const key of Object.keys(body.items)) {
        const index = body.items[key];

        if (index >= 0) result[key] = items[index];
      }
    }

    response.write(JSON.stringify(result));
    response.end();
  } catch (e) {
    console.error(e);

    response.writeHead(400);
    response.write(
      JSON.stringify(
        Object.assign(
          {
            e
          },
          {
            message: e.message
          }
        )
      )
    );

    response.end();
  }
}

async function pg(request, response) {
  if (!/post/i.test(request.method)) {
    return response.writeHead(405).end();
  }

  const buffers = [];

  for await (const chunk of request) {
    buffers.push(chunk);
  }

  response.setHeader('Content-Type', 'application/json; charset=UTF-8');

  try {
    const body = JSON.parse(Buffer.concat(buffers).toString());

    if (!body.connectionString || typeof body.connectionString !== 'string')
      return response.writeHead(422).end();

    if (!body.query || typeof body.query !== 'string')
      return response.writeHead(422).end();

    let connection;

    try {
      connection = new Connection(body.connectionString);

      await connection.connect();

      const result = await connection.execute(body.query, body.options ?? {});

      response.write(JSON.stringify(result));
      response.end();
    } finally {
      if (connection) await connection.close();
    }
  } catch (e) {
    console.error(e);

    response.writeHead(400);
    response.write(
      JSON.stringify(
        Object.assign(
          {
            e
          },
          {
            message: e.message
          }
        )
      )
    );

    response.end();
  }
}

async function redis(request, response) {
  if (!/post/i.test(request.method)) {
    return response.writeHead(405).end();
  }

  const buffers = [];

  for await (const chunk of request) {
    buffers.push(chunk);
  }

  response.setHeader('Content-Type', 'application/json; charset=UTF-8');

  let errorOccurred;

  try {
    const body = JSON.parse(Buffer.concat(buffers).toString());

    if (!body.options || typeof body.options !== 'object')
      return response.writeHead(422).end();

    if (!body.command || typeof body.command !== 'string')
      return response.writeHead(422).end();

    if (!Array.isArray(body.args)) body.args = [];

    const client = new Redis(
      Object.assign({}, body.options, { lazyConnect: true })
    );

    client.on('error', (e) => {
      console.dir(e);

      errorOccurred = true;

      response.writeHead(400);
      response.write(
        JSON.stringify(
          Object.assign(
            {
              e
            },
            {
              message: e.message
            }
          )
        )
      );

      response.end();
    });

    try {
      await client.connect();

      const result = await client[body.command]?.apply(client, body.args);

      response.write(
        typeof result === 'object'
          ? JSON.stringify(result)
          : result.toString() ?? ''
      );
      response.end();
    } finally {
      client.quit();
    }
  } catch (e) {
    if (errorOccurred) return;

    console.error(e);

    response.writeHead(400);
    response.write(
      JSON.stringify(
        Object.assign(
          {
            e
          },
          {
            message: e.message
          }
        )
      )
    );

    response.end();
  }
}

async function ssh(request, response) {
  if (!/post/i.test(request.method)) {
    return response.writeHead(405).end();
  }

  const buffers = [];

  for await (const chunk of request) {
    buffers.push(chunk);
  }

  let client;

  try {
    const body = JSON.parse(Buffer.concat(buffers).toString());

    if (!body.cmd || typeof body.cmd !== 'string')
      return response.writeHead(422).end();

    response.setHeader('Transfer-Encoding', 'chunked');
    response.setHeader('Content-Type', 'application/json; charset=UTF-8');

    client = new SSHClient();

    client
      .on('ready', () => {
        client.exec(body.cmd, { pty: true }, (err, stream) => {
          if (err) {
            console.error(err);

            response.writeHead(503);
            response.write(
              JSON.stringify({
                e: {
                  level: err.level,
                  message: err.message
                }
              })
            );

            return response.end();
          }

          stream
            .on('close', () => {
              client.end();
            })
            .on('data', (data) => {
              response.write(data.toString());
            })
            .stderr.on('data', (data) => {
              response.write(data.toString());
            });
        });
      })
      .on('error', (e) => {
        console.error(e);

        if (!response.writableEnded) {
          response.writeHead(400);
          response.write(
            JSON.stringify({
              e: {
                level: e.level,
                message: e.message
              }
            })
          );
          response.end();
        }
      })
      .on('end', () => response.end())
      .connect(body);

    request.on('close', () => client.end());
  } catch (e) {
    console.error(e);

    if (client) client.end();

    response.writeHead(400);
    response.write(
      JSON.stringify({
        e: {
          message: e.message
        }
      })
    );

    response.end();
  }
}

createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, PATCH, DELETE'
  );
  response.setHeader('Access-Control-Allow-Headers', '*');

  if (/options/i.test(request.method)) {
    return response.writeHead(200).end();
  }

  switch (request.url) {
    case '/':
      response.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      response.write(`https://${request.headers.host}`);
      response.end();

      break;
    case '/fetch':
      return $fetch(request, response);
    case '/ssh':
      return ssh(request, response);
    case '/pg':
      return pg(request, response);
    case '/redis':
      return redis(request, response);
    case '/pdf':
      return pdf(request, response);
    case '/ping':
      response.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      response.write('pong');
      response.end();

      break;
    default:
      response.writeHead(404).end();
  }
}).listen(process.env.PORT ?? 3777);
