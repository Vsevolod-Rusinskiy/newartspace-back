import { Table, Column, Model } from 'sequelize-typescript';

@Table
export class Painting extends Model {
  @Column
  paintingUrl: string;

  @Column
  author: string;

  @Column
  name: string;

  @Column
  artType: string;

  @Column
  price: number;

  @Column
  theme: string;

  @Column
  style: string;

  @Column
  base: string;

  @Column
  materials: string;

  @Column
  height: number;

  @Column
  width: number;

  @Column
  yearOfCreation: number;

  @Column
  format: string;

  @Column
  color: string;
}
