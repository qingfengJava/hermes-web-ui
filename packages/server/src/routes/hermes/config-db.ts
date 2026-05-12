import Router from '@koa/router'
import * as ctrl from '../../controllers/hermes/config-db'

export const configDbRoutes = new Router()

configDbRoutes.get('/api/hermes/config-db/:table', ctrl.listConfig)
configDbRoutes.post('/api/hermes/config-db/:table', ctrl.createConfig)
configDbRoutes.put('/api/hermes/config-db/:table/:id', ctrl.updateConfig)
configDbRoutes.delete('/api/hermes/config-db/:table/:id', ctrl.deleteConfig)
