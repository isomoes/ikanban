use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .add_column(ColumnDef::new(Tasks::Branch).string())
                    .add_column(ColumnDef::new(Tasks::WorkingDir).string())
                    .add_column(ColumnDef::new(Tasks::ParentTaskId).uuid())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Tasks::Table)
                    .drop_column(Tasks::Branch)
                    .drop_column(Tasks::WorkingDir)
                    .drop_column(Tasks::ParentTaskId)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Branch,
    WorkingDir,
    ParentTaskId,
}
