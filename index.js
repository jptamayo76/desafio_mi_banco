const { Pool } = require("pg");
const Cursor = require("pg-cursor");
const config = {
    user: 'postgres',
    password: 'inzane76',
    host: 'localhost',
    database: 'banco',
    port: 5432,
}
const pool = new Pool(config);

function showUsage() {
    console.log("Uso : \n");
    console.log("Agregar nueva compra a una cuenta ");
    console.log("node index.js comprar 'Lavadora Full-Plus pro' valor cuenta_destino cuenta origen\n");
    console.log("Mostrar compras por cuenta ");
    console.log("node index.js consultar-compras cuenta\n");
    console.log("Consultar saldo por cuenta ");
    console.log("node index.js consultar-saldo cuenta\n");
}

function ingresarCompra(descripcion, valor, cuenta_destino, cuenta_origen) {
    pool.connect(async (error_conexion, client, release) => {
        if (error_conexion) return console.error("Error de conexión:", error_conexion.code);

        let registerResponse;

        await client.query("BEGIN");
        try {
            const discountQuery = {
                text: "UPDATE cuentas SET saldo = saldo - $1 WHERE id = $2;",
                values: [valor, cuenta_origen],
            };
            await client.query(discountQuery);

            const depositQuery = {
                text: "UPDATE cuentas SET saldo = saldo + $1 WHERE id = $2;",
                values: [valor, cuenta_destino],
            };
            await client.query(depositQuery);

            const hoy = new Date().toLocaleDateString();
            const registerQuery = {
                text: "INSERT INTO transacciones(descripcion, fecha, monto, cuenta) VALUES ($1, $2, $3, $4) RETURNING * ",
                values: [descripcion, hoy, valor, cuenta_origen],
            };

            registerResponse = await client.query(registerQuery);
            console.log('\nUltima transaccion agregada :\n');
            console.log('ID transaccion :', registerResponse.rows[0].id);
            console.log('Descripcion compra :', registerResponse.rows[0].descripcion);
            console.log('Fecha :', registerResponse.rows[0].fecha);
            console.log('Monto :', registerResponse.rows[0].monto);
            console.log('Cuenta :', registerResponse.rows[0].cuenta);

            //console.log('Ultima transaccion agregada :\n' + JSON.stringify(registerResponse.rows[0]));
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            if (e.code) {
                console.log("Error código: " + e.code);
                console.log("Detalle del error: " + e.detail);
                console.log("Tabla originaria del error: " + e.table);
                console.log("Restricción violada en el campo: " + e.constraint);
            } else {
                console.log("Error : " + e);
            }
        } finally {
            release();
            pool.end();
        }
    });
}

function consultarSaldo(cuenta) {
    pool.connect(async (error_conexion, client, release) => {
        if (error_conexion) return console.error("Error de conexión:", error_conexion.code);

        const text = "SELECT saldo FROM cuentas WHERE id = $1;";
        const values = [cuenta];
        try {
            const consulta = new Cursor(text, values);
            const cursor = client.query(consulta);
            const salida = await cursor.read(1);
            console.log(`\nEl saldo en la cuenta ${cuenta} es de ${salida[0].saldo} pesos\n`);
        } catch (err) {
            if (err.detail) {
                console.log("\nError al consultar cuenta: ", err.detail);
                console.log("Codigo de Error:", err.code);
            } else {
                console.log(`\nNo existe la cuenta ${cuenta} !!!\n`);
            }
        } finally {
            client.release()
            pool.end();
        }
    });
}

function consultarCompras(cuenta) {
    pool.connect(async (error_conexion, client, release) => {
        if (error_conexion) return console.error("Error de conexión:", error_conexion.code);

        const text = "SELECT * FROM transacciones WHERE cuenta = $1;";
        const values = [cuenta];
        try {
            const consulta = new Cursor(text, values);
            const cursor = client.query(consulta);
            const salida = await cursor.read(10);
            if (salida.length) {
                console.log(`\n10 primeras compras de la cuenta ${cuenta}:\n\n`, salida);
            } else {
                console.log(`\nLa cuenta ${cuenta} no registra transacciones\n`);
            }
        } catch (err) {
            if (err.detail) {
                console.log("\nError al consultar compras: ", err.detail);
                console.log("Codigo de Error:", err.code);
            } else {
                console.log(`\nNo existe la cuenta ${cuenta} !!!\n`);
            }
        } finally {
            client.release()
            pool.end();
        }
    });
}

if (process.argv.length >= 4 && process.argv.length <= 7) {
    switch (process.argv[2]) {
        case 'comprar':
            if (process.argv.length === 7) {
                ingresarCompra(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
            }
            else {
                showUsage();
            }
            break;
        case 'consultar-saldo':
            if (process.argv.length === 4) {
                consultarSaldo(process.argv[3]);
            }
            else {
                showUsage();
            }
            break;
        case 'consultar-compras':
            if (process.argv.length === 4) {
                consultarCompras(process.argv[3]);
            }
            else {
                showUsage();
            }
            break;
        default:
            showUsage();
    }
}
else {
    showUsage();
}