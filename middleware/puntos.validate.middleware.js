import { puntoSchema } from "../schemas/puntos_visitables.js"

export function validatePunto(req, res, next){
    puntoSchema.validate(req.body,
            {
                abortEarly:false,       //se detiene en el primer error
                stripUnknown: true      //elimina automaticamente del obj los campos que no esten definidos en el esquema
            })
        .then( (data) => {
            req.body = data
            next()
        })
        .catch( (error) => res.status(400).json({message: error.errors}) )
}
