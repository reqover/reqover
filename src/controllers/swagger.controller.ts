import {NextFunction, Request, Response} from 'express';
import swaggerParser from '@apidevtools/swagger-parser';
import UrlPattern from 'url-pattern';
import {spec} from '../app';
import {SWAGGER_SPEC_URL} from '../config/constants';

class AuthController {
    public specs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            res.send(spec);
        } catch (error) {
            next(error);
        }
    };

    public info = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const apiList = await this.getSwaggerPaths(SWAGGER_SPEC_URL);
            res.send(apiList);
        } catch (error) {
            next(error);
        }
    };

    public report = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const reportData = await this.getCoverageReport(SWAGGER_SPEC_URL);
            res.render('index', {data: reportData});
        } catch (error) {
            next(error);
        }
    };

    public coverage = async (req: any, res: Response, next: NextFunction): Promise<void> => {
        try {
            res.send(await this.getCoverageReport(SWAGGER_SPEC_URL));
        } catch (error) {
            next(error);
        }
    };

    private getSwaggerPaths = async (swaggerSpec: any) => {
        const swaggerInfo: any = await swaggerParser.validate(swaggerSpec);
        const {basePath, paths} = swaggerInfo;
        const apiPaths = Object.entries(paths);

        const apiList = apiPaths.map(([apiPath, value]) => {
            const methods = Object.entries(value).map(([methodName, data]) => {
                const {responses, parameters} = data;
                return {
                    path: `${basePath}${apiPath}`,
                    name: methodName.toUpperCase(),
                    responses: Object.keys(responses),
                    parameters,
                };
            });

            return {path: `${basePath}${apiPath}`, methods};
        });

        return apiList;
    };

    private getCoverageReport = async (swaggerSpec: any) => {
        const apiList = await this.getSwaggerPaths(swaggerSpec);
        const swaggerUrls = apiList.map((u: any) => u.path);

        const apiCovList: any = apiList.map((apiItem) => {
            const coveredApis = this.findCoveredApis(apiItem, swaggerUrls);

            const coveredMethods = apiItem.methods.map((method) => {
                const {name, responses, parameters} = method;
                const coveredMethods: any = coveredApis.filter((c) => c.method == name);
                const coveredStatusCodes = [...new Set(coveredMethods.map((m) => m.response))];
                const missingStatusCodes = responses.filter((s) => !coveredStatusCodes.includes(s));

                const coveredParameters = coveredMethods
                    .map((m) => {
                        return m.parameters.map((p) => p.name);
                    })
                    .flat();
                const missingParameters = parameters
                    .map(({name, required, type, ...p}) => {
                        return {name, required, in: p.in, type};
                    })
                    .map((mp) => mp.name)
                    .filter((m) => !coveredParameters.includes(m));

                const coverage = ((coveredStatusCodes.length / (coveredStatusCodes.length + missingStatusCodes.length)) * 100).toFixed();

                let status = 'danger';
                status = +coverage > 0 && +coverage < 100 ? 'warning' : 'success';

                return {
                    path: apiItem['path'],
                    method: name,
                    coverage,
                    status,
                    responses: {
                        missed: missingStatusCodes,
                        covered: coveredStatusCodes,
                    },
                    parameters: {
                        missed: missingParameters,
                        covered: coveredParameters,
                    },
                };
            });

            return coveredMethods;
        });

        return apiCovList.flat();
    };

    private regExMatchOfPath = (apiPath: string, rPath: string) => {
        return new UrlPattern(apiPath.replace(/\/{/g, '{/:'), {
            optionalSegmentStartChar: '{',
            optionalSegmentEndChar: '}',
        }).match(rPath);
    };

    private findCoveredApis = (apiItem: any, swaggerUrls: any) => {
        const apiPath = apiItem['path'];
        return spec.filter((path) => {
            const currentPath = path['path'];
            if (apiPath != currentPath && this.isSwaggerUrl(swaggerUrls, currentPath)) {
                return false;
            }

            return this.regExMatchOfPath(apiPath, currentPath);
        });
    };

    private isSwaggerUrl(swaggerUrls, path): boolean {
        return swaggerUrls.includes(path);
    }
}

export default AuthController;
