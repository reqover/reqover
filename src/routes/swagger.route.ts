import {Router} from 'express';
import SwaggerController from '../controllers/swagger.controller';

class SwaggerRoute {
    public router = Router();
    public swaggerController = new SwaggerController();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get('/info', this.swaggerController.info);
        this.router.get('/report', this.swaggerController.report);
        this.router.get('/coverage', this.swaggerController.coverage);
        this.router.get('/specs', this.swaggerController.specs);
        this.router.get('/reset', this.swaggerController.reset);
    }
}

export default SwaggerRoute;
