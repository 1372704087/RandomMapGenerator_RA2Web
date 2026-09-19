// 0x5980c0 NextGaussian size=9B

double __thiscall sub_5980C0(double *this)
{
  double v3; // st7
  double v4; // st7
  long double v5; // st7
  long double v6; // st6
  double v7; // [esp+10h] [ebp-10h]
  double v8; // [esp+18h] [ebp-8h]

  if ( *(_BYTE *)this != 0 )
  {
    *(_BYTE *)this = 0;
    return *(this + 1);
  }
  else
  {
    do
    {
      do
      {
        v3 = ((double (*)(void))*((_DWORD *)this + 4))();
        v7 = v3 + v3 - 1.0;
        v4 = ((double (*)(void))*((_DWORD *)this + 4))();
        v8 = v4 + v4 - 1.0;
        v5 = v8 * v8 + v7 * v7;
      }
      while ( v5 >= 1.0 );
    }
    while ( v5 == 0.0 );
    v6 = __FYL2X__(v5, 0.6931471805599453094);
    sub_4CAC40((-v6 - v6) / v5);
    *(_BYTE *)this = 1;
    *(this + 1) = v5 * v8;
    return v5 * v7;
  }
}
