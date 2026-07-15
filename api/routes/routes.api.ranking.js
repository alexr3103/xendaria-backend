import { Router } from "express";
import * as controllers from "../controllers/controller.api.ranking.js";
import { verifyToken } from "../../middleware/auth.middleware.js";

const route = Router();

route.get("/usuarios", controllers.getRankingUsuarios);
route.get("/lugares", controllers.getRankingLugares);
route.get("/mejor-votados", controllers.getRankingLugaresMejorVotados);
route.get("/me", verifyToken, controllers.getMiPosicionRanking);

export default route;
