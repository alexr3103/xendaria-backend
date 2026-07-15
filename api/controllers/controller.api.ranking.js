import * as serviceRanking from "../../services/ranking.service.js";

export async function getRankingUsuarios(req, res) {
  try {
    const usuarios = await serviceRanking.getRankingUsuarios({
      limit: req.query.limit,
    });

    return res.status(200).json({
      usuarios,
      top3: usuarios.slice(0, 3),
      ranking: usuarios.slice(3),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("[getRankingUsuarios]", error);
    return res.status(500).json({ message: "Error al obtener ranking de usuarios" });
  }
}

export async function getRankingLugares(req, res) {
  try {
    const lugares = await serviceRanking.getRankingLugares({
      limit: req.query.limit,
    });

    return res.status(200).json({
      lugares,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("[getRankingLugares]", error);
    return res.status(500).json({ message: "Error al obtener ranking de lugares" });
  }
}

export async function getRankingLugaresMejorVotados(req, res) {
  try {
    const lugares = await serviceRanking.getRankingLugaresMejorVotados({
      limit: req.query.limit,
      minEstrellas: req.query.minEstrellas ?? req.query.estrellas,
    });

    return res.status(200).json({
      lugares,
      top3: lugares.slice(0, 3),
      ranking: lugares.slice(3),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("[getRankingLugaresMejorVotados]", error);
    return res.status(500).json({ message: "Error al obtener lugares mejor votados" });
  }
}

export async function getMiPosicionRanking(req, res) {
  try {
    const posicion = await serviceRanking.getMiPosicionRanking(req.user.id);
    if (!posicion) return res.status(404).json({ message: "Usuario no encontrado" });

    return res.status(200).json(posicion);
  } catch (error) {
    console.error("[getMiPosicionRanking]", error);
    return res.status(500).json({ message: "Error al obtener tu posicion" });
  }
}
