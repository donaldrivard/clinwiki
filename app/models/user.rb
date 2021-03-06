class User < ApplicationRecord
  rolify
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :trackable, :validatable

  has_many :reviews, dependent: :destroy
  has_many :user_session_studies, dependent: :destroy
  # has_many :feeds, dependent: :destroy

  def admin?
    false
  end

  def self.find_or_create_from_payload(payload)
    user = where(email:payload["email"]).first_or_initialize do |user|
      user.first_name = payload["given_name"]
      user.last_name =  payload["family_name"]
      user.email = payload["email"]
      user.password = Devise.friendly_token(8)
    end
    user.save
    user
  end

  def full_name
    "#{first_name} #{last_name}"
  end
end
