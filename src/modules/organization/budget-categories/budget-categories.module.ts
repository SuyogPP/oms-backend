import { Module } from '@nestjs/common';
import { BudgetCategoriesController } from './controllers/budget-categories.controller';
import { BudgetCategoriesService } from './services/budget-categories.service';
import { BudgetCategoriesRepository } from './repositories/budget-categories.repository';

@Module({
  controllers: [BudgetCategoriesController],
  providers: [BudgetCategoriesService, BudgetCategoriesRepository],
  exports: [BudgetCategoriesService, BudgetCategoriesRepository],
})
export class BudgetCategoriesModule {}
