begin;

create table if not exists users (
	id serial primary key,
	username varchar(50) unique not null,
	password varchar(50) not null,
	role varchar(20),
	
	email varchar(255) unique not null,
	total_points int not null check (total_points >= 0),
	
	created_on timestamp not null default current_date,
	last_login timestamp not null default current_date
);

create table if not exists user_roles (
	id serial primary key,
	role_name varchar unique not null,
	
	created_on timestamp not null default current_date,
	last_login timestamp not null default current_date
);

create table if not exists question_types (
	id serial primary key,
	question_type varchar unique not null,
	points integer not null check (points >= 0),
	
	created_on timestamp not null default current_date,
	last_modified timestamp not null default current_date
);

create table if not exists question_categories (
	id serial primary key,
	name varchar unique not null,
	
	created_on timestamp not null default current_date,
	last_modified timestamp not null default current_date	
);


create table if not exists questions (
	id serial primary key,
	question_type int not null,
	
	question_text varchar not null,
	answers varchar[] not null,
	category int,

	followup_question int,
	created_on timestamp not null default current_date,
	last_modified timestamp not null default current_date,
	
	constraint fk_question_types foreign key (question_type) references question_types(id),
	constraint fk_question_categories foreign key (category) references question_categories(id)
);

create table if not exists games (
	id serial primary key,
	name varchar not null unique,

	created_on timestamp not null default current_date,
	last_modified timestamp not null default current_date	
);


rollback;

