import { getDB } from "./db.js";

const CLAVE_CONFIG_ENVIO = "costos_envio";

const CONFIG_DEFAULT = {
  clave: CLAVE_CONFIG_ENVIO,
  envioGratisDesde: 100000,
  costos: {
    capital_federal: 4900,
    conurbano_buenos_aires: 5500,
    buenos_aires: 6200,
    resto_pais: 6900,
  },
};

function collection() {
  return getDB().collection("configuracion");
}

export async function getConfiguracionEnvio() {
  let config = await collection().findOne({ clave: CLAVE_CONFIG_ENVIO });

  if (!config) {
    const nuevaConfig = {
      ...CONFIG_DEFAULT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await collection().insertOne(nuevaConfig);
    config = nuevaConfig;
  }

  return config;
}

export async function actualizarConfiguracionEnvio(data) {
  const actual = await getConfiguracionEnvio();

  const configuracionActualizada = {
    ...actual,
    envioGratisDesde:
      data.envioGratisDesde ?? actual.envioGratisDesde,
    costos: {
      ...actual.costos,
      ...(data.costos || {}),
    },
    updatedAt: new Date(),
  };

  await collection().updateOne(
    { clave: CLAVE_CONFIG_ENVIO },
    {
      $set: {
        envioGratisDesde: configuracionActualizada.envioGratisDesde,
        costos: configuracionActualizada.costos,
        updatedAt: configuracionActualizada.updatedAt,
      },
    }
  );

  return configuracionActualizada;
}

export async function calcularCostoEnvio(provincia, subtotal) {
  const config = await getConfiguracionEnvio();

  if (subtotal >= config.envioGratisDesde) {
    return 0;
  }

  if (provincia === "capital_federal") {
    return config.costos.capital_federal;
  }

  if (provincia === "conurbano_buenos_aires") {
    return config.costos.conurbano_buenos_aires;
  }

  if (provincia === "buenos_aires") {
    return config.costos.buenos_aires;
  }

  return config.costos.resto_pais;
}